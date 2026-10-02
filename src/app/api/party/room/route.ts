import { NextRequest, NextResponse } from "next/server";
import { rateLimitByIp, rateLimitResponse } from "@/lib/rateLimitServer";
import { proxyToPython } from "@/app/api/_lib/pythonOrigin";

export const runtime = "nodejs";

/** Public room metadata for party join (encrypted payload only — key stays in URL hash). */
export async function GET(request: NextRequest) {
  const limit = await rateLimitByIp(request, "party-room", 30, "1 m");
  if (!limit.success) return rateLimitResponse(limit);

  const roomId = request.nextUrl.searchParams.get("id");
  if (!roomId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  return proxyToPython(request, `/parties/${encodeURIComponent(roomId)}/public-meta`);
}
