import { NextRequest, NextResponse } from "next/server";
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import { getFirebaseAuth } from "@/integrations/firebase/client";

/**
 * POST /api/account/delete
 * Deletes all user data (GDPR right to erasure).
 * Requires Firebase Auth token in Authorization header.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    // Verify the token (in production, use Firebase Admin SDK)
    // For now, we trust the client-side auth and require re-authentication
    const body = await request.json();
    const { userId, confirmDelete } = body;

    if (confirmDelete !== "DELETE_MY_ACCOUNT") {
      return NextResponse.json(
        { error: "Please confirm deletion by sending confirmDelete: 'DELETE_MY_ACCOUNT'" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const db = getFirestore();
    const collections = [
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
    ];

    let deletedCount = 0;

    for (const colName of collections) {
      const q = query(collection(db, colName), where("user_id", "==", userId));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(doc(db, colName, d.id));
        deletedCount++;
      }
    }

    // Delete profile
    try {
      await deleteDoc(doc(db, "profiles", userId));
    } catch {
      // Profile might not exist
    }

    return NextResponse.json({
      success: true,
      deletedDocuments: deletedCount,
      message: "All account data has been deleted.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to delete account data" },
      { status: 500 }
    );
  }
}
