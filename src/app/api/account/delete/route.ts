import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeader } from "@/lib/firebase/verifyAuth";
import { requireAppCheck } from "@/lib/firebase/verifyAppCheck";
import { getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const USER_COLLECTIONS = [
  "reviews",
  "comments",
  "likes",
  "review_likes",
  "content_ratings",
  "follows",
  "user_movie_lists",
  "watch_history",
  "notifications",
  "activity_feed",
  "timeline_comments",
  "reports",
  "member_profiles",
  "user_settings",
  "subscriptions",
] as const;

/**
 * POST /api/account/delete — GDPR erasure via Admin SDK.
 */
export async function POST(request: NextRequest) {
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

  const body = await request.json();
  if (body.confirmDelete !== "DELETE_MY_ACCOUNT") {
    return NextResponse.json(
      { error: "Send confirmDelete: 'DELETE_MY_ACCOUNT'" },
      { status: 400 }
    );
  }

  const uid = auth.uid;
  let deletedCount = 0;

  try {
    for (const colName of USER_COLLECTIONS) {
      const snap = await db.collection(colName).where("user_id", "==", uid).get();
      const batch = db.batch();
      snap.docs.forEach((d) => {
        batch.delete(d.ref);
        deletedCount++;
      });
      if (!snap.empty) await batch.commit();
    }

    // Alternate field names
    const followsSnap = await db.collection("follows").where("follower_id", "==", uid).get();
    if (!followsSnap.empty) {
      const batch = db.batch();
      followsSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      deletedCount += followsSnap.size;
    }

    await db.collection("profiles").doc(uid).delete().catch(() => {});
    await db.collection("subscriptions").doc(uid).delete().catch(() => {});

    return NextResponse.json({
      success: true,
      deletedDocuments: deletedCount,
      message: "Account data deleted. Sign out and contact support to remove Firebase Auth user.",
    });
  } catch (err) {
    console.error("Account delete failed:", err);
    return NextResponse.json({ error: "Failed to delete account data" }, { status: 500 });
  }
}
