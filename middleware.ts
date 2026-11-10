import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cspValue } from "./security-headers.mjs";

/** Apply the site-wide CSP and request correlation ID. */
export function middleware(_request: NextRequest) {
  const requestId = crypto.randomUUID();
  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", cspValue);
  response.headers.set("X-Request-ID", requestId);
  return response;
}

export const config = {
  // Skip immutable/static assets — they don't need CSP or a correlation ID.
  // Pages and API routes still get both.
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:ico|svg|png|jpe?g|gif|webp|txt|xml|json|webmanifest)).*)",
  ],
};
