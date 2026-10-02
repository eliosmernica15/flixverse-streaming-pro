import { NextRequest, NextResponse } from "next/server";
import { rateLimitByIp, rateLimitResponse } from "@/lib/rateLimitServer";

/**
 * Returns a low-res trailer preview URL for offline caching.
 * Uses YouTube's direct stream when trailer key is provided.
 */
export async function GET(request: NextRequest) {
  const limit = await rateLimitByIp(request, "offline-manifest", 30, "1 m");
  if (!limit.success) return rateLimitResponse(limit);

  const key = request.nextUrl.searchParams.get("key");
  if (!key || !/^[a-zA-Z0-9_-]{6,20}$/.test(key)) {
    return NextResponse.json({ error: "Invalid trailer key" }, { status: 400 });
  }

  // YouTube watch URL — clients cache via fetch; full offline playback uses trailer blob
  const url = `https://www.youtube.com/watch?v=${key}`;

  return NextResponse.json(
    { url, type: "trailer", key },
    { headers: { "Cache-Control": "private, max-age=3600" } }
  );
}
