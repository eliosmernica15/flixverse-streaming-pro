import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cspWithNonce } from "./security-headers.mjs";

/** Apply the site-wide CSP (nonce-based) and request correlation ID. */
export function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const nonce = crypto.randomUUID().replace(/-/g, "").slice(0, 24);

  const requestHeaders = new Headers(request.headers);
  // Server components read this via next/headers() to set <script nonce>.
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("Content-Security-Policy", cspWithNonce(nonce));
  response.headers.set("X-Request-ID", requestId);
  return response;
}

export const config = {
  // Skip immutable/static assets - they don't need CSP or a correlation ID.
  // Pages and API routes still get both.
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:ico|svg|png|jpe?g|gif|webp|txt|xml|json|webmanifest|js)).*)",
  ],
};
