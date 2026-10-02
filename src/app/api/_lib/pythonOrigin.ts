/**
 * Shared helpers for Next.js API routes that proxy to the Python backend.
 * Mirrors the pattern first used in src/app/api/party/room/route.ts.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Build the absolute origin under which the Python serverless function lives. */
export function pythonApiOrigin(request: NextRequest): string {
  // Prefer the host the user actually requested (x-forwarded-host / host).
  // `VERCEL_URL` is the deployment-specific URL
  // (e.g. flixverse-abc123-losis-projects.vercel.app) which is behind Vercel
  // Deployment Protection even when the production domain
  // (flixverse-streaming-pro.vercel.app) is public. Proxying to VERCEL_URL
  // from inside a Next route therefore gets intercepted by Vercel SSO and
  // returns the "Log in to Vercel" HTML page (401/200 text/html) instead of
  // the Python JSON — surfacing in the browser as
  // `POST /api/profile/username 401 (Unauthorized)`.
  // Using the request host keeps the internal fetch on the same public
  // domain the browser already reached, so no protection bypass is needed.
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

/** Build the absolute URL for a path on the Python serverless function. */
export function pythonApiUrl(request: NextRequest, path: string): string {
  const origin = pythonApiOrigin(request);
  const prefix = process.env.VERCEL === "1" ? "/api/flixverse" : "";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${prefix}${normalized}`;
}

/** Forward auth + deployment-protection context to the Python function. */
function buildProxyHeaders(request: NextRequest, initBody?: string): Headers {
  const headers = new Headers();
  const auth = request.headers.get("authorization");
  if (auth) headers.set("authorization", auth);

  // If production ever enables Deployment Protection, the browser's request
  // to the Next route carries the bypass cookie / header, but a bare
  // server-to-server fetch would not. Forward them so the internal fetch
  // passes the same Vercel SSO check the browser already passed.
  const bypass = request.headers.get("x-vercel-protection-bypass");
  if (bypass) headers.set("x-vercel-protection-bypass", bypass);
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);

  const contentType = request.headers.get("content-type");
  if (initBody !== undefined && contentType) {
    headers.set("content-type", contentType);
  }
  return headers;
}

/** Warn when the upstream returned the Vercel SSO login page instead of JSON. */
function warnIfProtectionPage(path: string, status: number, contentType: string | null, text: string): void {
  if (contentType?.includes("text/html") && /log in to vercel/i.test(text)) {
    console.error(
      `[proxy] ${path} hit Vercel Deployment Protection (upstream ${status} text/html). ` +
        `The internal fetch likely used a protected deployment URL instead of the request host.`
    );
  }
}

/** Forward a POST/GET/PATCH/DELETE through to the Python API. */
export async function proxyToPython(
  request: NextRequest,
  path: string,
  init: { method?: string; body?: string; passQuery?: boolean } = {}
): Promise<NextResponse> {
  const method = init.method ?? request.method;
  const url = new URL(pythonApiUrl(request, path));
  if (init.passQuery !== false) {
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.append(key, value);
    });
  }

  const headers = buildProxyHeaders(request, init.body);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: init.body,
      cache: "no-store",
    });
    const text = await res.text();
    const ct = res.headers.get("content-type");
    warnIfProtectionPage(path, res.status, ct, text);
    const responseHeaders = new Headers();
    if (ct) responseHeaders.set("content-type", ct);
    return new NextResponse(text, { status: res.status, headers: responseHeaders });
  } catch (err) {
    console.error(`[proxy] ${path} failed:`, err);
    return NextResponse.json(
      { error: "Upstream Python API unreachable", detail: String((err as Error)?.message ?? err) },
      { status: 503 }
    );
  }
}

/**
 * Same as `proxyToPython` but returns the parsed JSON body and the upstream
 * status separately. Useful when the Next.js route needs to inspect the
 * Python response before composing its own response (e.g. billing routes
 * that call Python for the `stripeCustomerId` and then call Stripe directly).
 */
export async function callPythonJson<T = unknown>(
  request: NextRequest,
  path: string,
  init: { method?: string; body?: string; passQuery?: boolean } = {}
): Promise<{ status: number; data: T | null; error: string | null }> {
  const method = init.method ?? request.method;
  const url = new URL(pythonApiUrl(request, path));
  if (init.passQuery !== false) {
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.append(key, value);
    });
  }

  const headers = buildProxyHeaders(request, init.body);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: init.body,
      cache: "no-store",
    });
    const text = await res.text();
    warnIfProtectionPage(path, res.status, res.headers.get("content-type"), text);
    let data: T | null = null;
    try {
      data = text ? (JSON.parse(text) as T) : null;
    } catch {
      data = null;
    }
    return { status: res.status, data, error: res.ok ? null : text };
  } catch (err) {
    return {
      status: 503,
      data: null,
      error: `Upstream Python API unreachable: ${String((err as Error)?.message ?? err)}`,
    };
  }
}
