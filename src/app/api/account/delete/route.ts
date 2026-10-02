import { NextRequest, NextResponse } from "next/server";
import { rateLimitByIp, rateLimitResponse } from "@/lib/rateLimitServer";
import { proxyToPython } from "@/app/api/_lib/pythonOrigin";

export const runtime = "nodejs";

/**
 * POST /api/account/delete — GDPR erasure.
 *
 * Proxies the request to the Python API's `/account/delete` route. The
 * Python side validates the `confirmDelete: "DELETE_MY_ACCOUNT"` body and
 * walks every SQL table the user owns.
 */
export async function POST(request: NextRequest) {
  const limit = await rateLimitByIp(request, "account-delete", 3, "1 h");
  if (!limit.success) return rateLimitResponse(limit);

  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  return proxyToPython(request, "/account/delete", {
    method: "POST",
    body,
    passQuery: false,
  });
}
