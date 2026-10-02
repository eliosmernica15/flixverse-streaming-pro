import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cspValue } from "./security-headers.mjs";

/**
 * Apply the site-wide Content-Security-Policy everywhere EXCEPT
 * `/api/embed`.
 *
 * `/api/embed` serves third-party provider HTML (vidsrc, videasy, …)
 * same-origin through our proxy. A global CSP from next.config
 * `headers()` would also apply to that proxied HTML and block the
 * provider's own scripts (`script-src 'self'`) and `<base>` tag
 * (`base-uri 'self'`), leaving a white player. next.config headers
 * cannot exclude a path (all matching sources merge), so CSP lives here
 * where we can skip the embed proxy. The embed route itself sends no CSP,
 * letting provider scripts run.
 */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/embed")) {
    return NextResponse.next();
  }
  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", cspValue);
  return response;
}

export const config = {
  matcher: "/:path*",
};
