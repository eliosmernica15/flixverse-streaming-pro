import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

/** Public room metadata for party join (encrypted payload only — key stays in URL hash). */
export async function GET(request: NextRequest) {
  const roomId = request.nextUrl.searchParams.get("id");
  if (!roomId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
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
      code: data.code,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch room" }, { status: 500 });
  }
}
