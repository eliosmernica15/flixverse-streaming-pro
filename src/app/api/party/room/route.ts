import { NextRequest, NextResponse } from "next/server";
import { doc, getDoc } from "firebase/firestore";
import { getFirestore } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";

function getDb() {
  if (!getApps().length) {
    initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }
  return getFirestore();
}

/** Public room metadata for party join (encrypted payload only — key stays in URL hash). */
export async function GET(request: NextRequest) {
  const roomId = request.nextUrl.searchParams.get("id");
  if (!roomId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  try {
    const snap = await getDoc(doc(getDb(), "flix_parties", roomId));
    if (!snap.exists()) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    const data = snap.data();
    return NextResponse.json({
      encryptedPayload: data.encryptedPayload,
      code: data.code,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch room" }, { status: 500 });
  }
}
