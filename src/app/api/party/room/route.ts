import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { rateLimitByIp, rateLimitResponse } from "@/lib/rateLimitServer";

export const runtime = "nodejs";

function pythonApiOrigin(request: NextRequest): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

/** Public room metadata for party join (encrypted payload only — key stays in URL hash). */
export async function GET(request: NextRequest) {
  const limit = await rateLimitByIp(request, "party-room", 30, "1 m");
  if (!limit.success) return rateLimitResponse(limit);

  const roomId = request.nextUrl.searchParams.get("id");
  if (!roomId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  if (process.env.NEXT_PUBLIC_USE_PYTHON_API === "true") {
    try {
      const origin = pythonApiOrigin(request);
      const res = await fetch(`${origin}/api/flixverse/parties/${roomId}/public-meta`, {
        next: { revalidate: 0 },
      });
      if (res.ok) {
        return NextResponse.json(await res.json());
      }
    } catch {
      /* fall through to Firestore */
    }
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  try {
    const snap = await db.collection("flix_parties").doc(roomId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    const data = snap.data()!;
    return NextResponse.json({
      encryptedPayload: data.encryptedPayload,
      contentMeta: data.contentMeta ?? null,
      code: data.code,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch room" }, { status: 500 });
  }
}
