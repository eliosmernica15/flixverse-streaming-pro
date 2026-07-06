import { NextRequest, NextResponse } from "next/server";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";

/**
 * GET /api/account/export
 * Exports all user data as JSON (GDPR right to data portability).
 * Requires Firebase Auth token in Authorization header.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const db = getFirestore();
    const exportData: Record<string, unknown[]> = {};
    let totalRecords = 0;

    const collectionsToExport: Array<{ name: string; field: string }> = [
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
    ];

    for (const { name, field } of collectionsToExport) {
      try {
        const q = query(collection(db, name), where(field, "==", userId));
        const snap = await getDocs(q);
        const items: unknown[] = [];
        snap.forEach((d) => {
          items.push({ id: d.id, ...d.data() });
        });
        exportData[name] = items;
        totalRecords += items.length;
      } catch {
        // Collection might not exist or have permissions
      }
    }

    const exportPayload = {
      exportDate: new Date().toISOString(),
      userId,
      totalRecords,
      data: exportData,
    };

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="flixverse-data-export-${userId}.json"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to export account data" },
      { status: 500 }
    );
  }
}
