/**
 * Shared helpers for Next.js API routes that proxy to the Python backend.
 * Mirrors the pattern first used in src/app/api/party/room/route.ts.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Build the absolute origin under which the Python serverless function lives. */
export function pythonApiOrigin(request: NextRequest): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

/** Build the absolute URL for a path on the Python serverless function. */
export function pythonApiUrl(request: NextRequest, path: string): string {
  const origin = pythonApiOrigin(request);
  const prefix = process.env.VERCEL === "1" ? "/api/flixverse" : "";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${prefix}${normalized}`;
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

  const headers = new Headers();
  const auth = request.headers.get("authorization");
  if (auth) headers.set("authorization", auth);

  const contentType = request.headers.get("content-type");
  if (init.body !== undefined && contentType) {
    headers.set("content-type", contentType);
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: init.body,
      cache: "no-store",
    });
    const text = await res.text();
    const responseHeaders = new Headers();
    const ct = res.headers.get("content-type");
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

  const headers = new Headers();
  const auth = request.headers.get("authorization");
  if (auth) headers.set("authorization", auth);

  const contentType = request.headers.get("content-type");
  if (init.body !== undefined && contentType) {
    headers.set("content-type", contentType);
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: init.body,
      cache: "no-store",
    });
    const text = await res.text();
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
