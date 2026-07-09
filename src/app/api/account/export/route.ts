import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeader } from "@/lib/firebase/verifyAuth";
import { requireAppCheck } from "@/lib/firebase/verifyAppCheck";
import { getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const COLLECTIONS: Array<{ name: string; field: string }> = [
  { name: "profiles", field: "user_id" },
  { name: "reviews", field: "user_id" },
  { name: "comments", field: "user_id" },
  { name: "likes", field: "user_id" },
  { name: "content_ratings", field: "user_id" },
  { name: "user_movie_lists", field: "user_id" },
  { name: "watch_history", field: "user_id" },
  { name: "notifications", field: "user_id" },
  { name: "activity_feed", field: "user_id" },
  { name: "timeline_comments", field: "userId" },
  { name: "member_profiles", field: "ownerId" },
  { name: "user_settings", field: "userId" },
];

export async function GET(request: NextRequest) {
  const auth = await verifyAuthHeader(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await requireAppCheck(request))) {
    return NextResponse.json({ error: "App Check verification failed" }, { status: 403 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const uid = auth.uid;
  const exportData: Record<string, unknown[]> = {};
  let totalRecords = 0;

  try {
    for (const { name, field } of COLLECTIONS) {
      const snap = await db.collection(name).where(field, "==", uid).get();
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      exportData[name] = items;
      totalRecords += items.length;
    }

    const profileSnap = await db.collection("profiles").doc(uid).get();
    if (profileSnap.exists) {
      exportData.profiles = [{ id: profileSnap.id, ...profileSnap.data() }];
      totalRecords += 1;
    }

    const subSnap = await db.collection("subscriptions").doc(uid).get();
    if (subSnap.exists) {
      exportData.subscriptions = [{ id: subSnap.id, ...subSnap.data() }];
      totalRecords += 1;
    }

    const payload = {
      exportDate: new Date().toISOString(),
      userId: uid,
      totalRecords,
      data: exportData,
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="flixverse-export-${uid}.json"`,
      },
    });
  } catch (err) {
    console.error("Export failed:", err);
    return NextResponse.json({ error: "Failed to export account data" }, { status: 500 });
  }
}
