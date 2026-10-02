import { NextRequest, NextResponse } from "next/server";
import { rateLimitByIp, rateLimitResponse } from "@/lib/rateLimitServer";
import { proxyToPython } from "@/app/api/_lib/pythonOrigin";

export const runtime = "nodejs";

/**
 * Notification dispatch — thin proxy to the Python API.
 *
 * Front-end clients already go through `lib/notifications/createNotification.ts`
 * which prefers `pythonFetch("/notifications/dispatch")` when the Python
 * backend is enabled. This Next.js route is kept for symmetry and for
 * any third-party caller that hits the legacy `/api/notifications/dispatch`
 * endpoint.
 */
export async function POST(request: NextRequest) {
  const limit = await rateLimitByIp(request, "notification-dispatch", 60, "1 m");
  if (!limit.success) return rateLimitResponse(limit);

  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  return proxyToPython(request, "/notifications/dispatch", {
    method: "POST",
    body,
    passQuery: false,
  });
}
