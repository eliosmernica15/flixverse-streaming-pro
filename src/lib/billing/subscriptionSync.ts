/**
 * Subscription sync — mirrors Stripe subscription state into the
 * Python `subscriptions` table through authenticated internal endpoints.
 *
 * Webhook updates use a server-to-server token; user-facing sync remains
 * protected by Firebase bearer-token verification in the Python API.
 */

export type BillingPlan = "standard" | "premium";
export type BillingStatus =
  | "active"
  | "trialing"
  | "canceled"
  | "past_due"
  | "unpaid"
  | "incomplete";

export interface SubscriptionRecord {
  plan: BillingPlan | "free";
  status: BillingStatus | "none";
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: number;
  updatedAt: number;
}

/** Proration preview response for plan changes. */
export interface ProrationPreview {
  /** Amount the user will be charged/credited (in cents, positive = charge, negative = credit) */
  amount: number;
  /** Currency code (e.g., "usd") */
  currency: string;
  /** Human-readable description of the proration */
  description: string;
  /** Whether this is an upgrade (true) or downgrade (false) */
  isUpgrade: boolean;
  /** Next billing period start timestamp (ms) */
  nextPeriodStart: number;
  /** Current subscription plan */
  currentPlan: BillingPlan;
  /** New subscription plan */
  newPlan: BillingPlan;
}

function mapStripeStatus(status: string): SubscriptionRecord["status"] {
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "canceled") return "canceled";
  if (status === "past_due") return "past_due";
  if (status === "unpaid") return "unpaid";
  if (status === "incomplete" || status === "incomplete_expired") return "incomplete";
  return "none";
}

function isPaidStatus(status: SubscriptionRecord["status"]): boolean {
  return status === "active" || status === "trialing";
}

const API_TIMEOUT_MS = 6000;

function pythonApiBaseUrl(requestOrigin?: string): string {
  const configuredBase =
    process.env.PYTHON_API_URL ||
    (process.env.VERCEL === "1" ? requestOrigin : "http://127.0.0.1:8000");
  if (!configuredBase) {
    throw new Error("Python API origin is unavailable");
  }
  const base = configuredBase.replace(/\/+$/, "");
  if (process.env.VERCEL === "1" && !base.endsWith("/api/flixverse")) {
    return `${base}/api/flixverse`;
  }
  return base;
}

async function requestPythonApi<T>(
  path: string,
  init: {
    method: "GET" | "POST";
    body?: Record<string, unknown>;
    requestOrigin?: string;
  }
): Promise<T> {
  const token = process.env.PYTHON_API_INTERNAL_TOKEN;
  if (!token) {
    throw new Error("PYTHON_API_INTERNAL_TOKEN is not configured");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(`${pythonApiBaseUrl(init.requestOrigin)}${path}`, {
      method: init.method,
      headers: {
        "x-internal-service-token": token,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Python API ${path} failed with status ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Write subscription state from Stripe webhooks (proxied through Python). */
export async function syncSubscriptionToFirestore(input: {
  userId: string;
  plan: BillingPlan;
  stripeStatus: string;
  customerId: string;
  subscriptionId: string;
  periodEndMs: number;
}, requestOrigin?: string): Promise<void> {
  const status = mapStripeStatus(input.stripeStatus);
  const plan = isPaidStatus(status) ? input.plan : "free";

  await requestPythonApi("/account/stripe-subscription-sync", {
    method: "POST",
    body: {
      userId: input.userId,
      plan,
      stripeStatus: status,
      customerId: input.customerId,
      subscriptionId: input.subscriptionId,
      periodEndMs: input.periodEndMs,
    },
    requestOrigin,
  });
}

/** Mark subscription canceled (subscription deleted). */
export async function cancelSubscriptionInFirestore(
  userId: string,
  customerId?: string,
  subscriptionId?: string,
  requestOrigin?: string
): Promise<void> {
  await requestPythonApi("/account/stripe-subscription-sync", {
    method: "POST",
    body: {
      userId,
      plan: "free",
      stripeStatus: "canceled",
      customerId,
      subscriptionId,
    },
    requestOrigin,
  });
}

export async function isWebhookEventProcessed(
  eventId: string,
  requestOrigin?: string
): Promise<boolean> {
  const result = await requestPythonApi<{ processed: boolean }>(
    `/account/stripe-webhook-events/${encodeURIComponent(eventId)}`,
    { method: "GET", requestOrigin }
  );
  return result.processed;
}

export async function markWebhookEventProcessed(
  eventId: string,
  eventType: string,
  requestOrigin?: string
): Promise<boolean> {
  const result = await requestPythonApi<{ processed: boolean }>(
    "/account/stripe-webhook-events",
    { method: "POST", body: { eventId, eventType }, requestOrigin }
  );
  return result.processed;
}

/** Fetch proration preview for a plan change. */
export async function getProrationPreview(input: {
  userId: string;
  newPlan: BillingPlan;
  newBillingPeriod?: "monthly" | "yearly";
}, requestOrigin?: string): Promise<ProrationPreview> {
  const result = await requestPythonApi<ProrationPreview>(
    "/account/proration-preview",
    {
      method: "POST",
      body: {
        userId: input.userId,
        newPlan: input.newPlan,
        newBillingPeriod: input.newBillingPeriod ?? "monthly",
      },
      requestOrigin,
    }
  );
  return result;
}

/** Cancel subscription with reason capture (internal use - calls user-facing endpoint with auth). */
export async function cancelSubscriptionWithReason(input: {
  userId: string;
  reason: string;
  details?: string;
  authToken: string; // Firebase ID token for user auth
}, requestOrigin?: string): Promise<{ success: boolean; message: string; cancelsAt: number | null }> {
  const baseUrl = pythonApiBaseUrl(requestOrigin).replace("/api/flixverse", "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/api/flixverse/subscription/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${input.authToken}`,
      },
      body: JSON.stringify({
        reason: input.reason,
        details: input.details,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Subscription cancel failed with status ${response.status}`);
    }
    return (await response.json()) as { success: boolean; message: string; cancelsAt: number | null };
  } finally {
    clearTimeout(timer);
  }
}
