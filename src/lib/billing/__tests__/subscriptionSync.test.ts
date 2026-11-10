import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isWebhookEventProcessed,
  markWebhookEventProcessed,
  syncSubscriptionToFirestore,
} from "../subscriptionSync";

const fetchMock = vi.fn<typeof fetch>();

describe("Stripe webhook subscription sync", () => {
  beforeEach(() => {
    vi.stubEnv("PYTHON_API_URL", "https://api.example.test");
    vi.stubEnv("PYTHON_API_INTERNAL_TOKEN", "test-internal-token");
    vi.stubEnv("VERCEL", "");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ processed: true }), { status: 200 })
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the internal token and persists subscription state", async () => {
    await syncSubscriptionToFirestore({
      userId: "user-1",
      plan: "premium",
      stripeStatus: "past_due",
      customerId: "cus-1",
      subscriptionId: "sub-1",
      periodEndMs: 1_800_000_000_000,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.test/account/stripe-subscription-sync");
    expect(options?.headers).toMatchObject({
      "x-internal-service-token": "test-internal-token",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(options?.body))).toMatchObject({
      userId: "user-1",
      plan: "free",
      stripeStatus: "past_due",
      customerId: "cus-1",
      subscriptionId: "sub-1",
    });
  });

  it("checks processed events and records them only after handling", async () => {
    await expect(isWebhookEventProcessed("evt/test")).resolves.toBe(true);
    await markWebhookEventProcessed("evt/test", "customer.subscription.updated");

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.example.test/account/stripe-webhook-events/evt%2Ftest"
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://api.example.test/account/stripe-webhook-events"
    );
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      eventId: "evt/test",
      eventType: "customer.subscription.updated",
    });
  });

  it("uses the deployment request origin for Vercel serverless API calls", async () => {
    vi.stubEnv("PYTHON_API_URL", "");
    vi.stubEnv("VERCEL", "1");

    await isWebhookEventProcessed("evt_1", "https://flixverse.example");

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://flixverse.example/api/flixverse/account/stripe-webhook-events/evt_1"
    );
  });

  it("propagates backend failures so the webhook can be retried", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "unavailable" }), { status: 503 })
    );

    await expect(isWebhookEventProcessed("evt_1")).rejects.toThrow(
      "Python API /account/stripe-webhook-events/evt_1 failed with status 503"
    );
  });
});
