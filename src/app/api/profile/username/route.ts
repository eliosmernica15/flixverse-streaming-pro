import { NextRequest, NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthHeader } from "@/lib/firebase/verifyAuth";
import { normalizeUsername, validateUsername } from "@/lib/username";
import { rateLimitByIp, rateLimitResponse } from "@/lib/rateLimitServer";

export const runtime = "nodejs";

/** GET ?q= — prefix search · GET ?username= — availability check */
export async function GET(request: NextRequest) {
  const usernameCheck = request.nextUrl.searchParams.get("username");
  if (usernameCheck !== null) {
    const limit = await rateLimitByIp(request, "username-check", 120, "1 m");
    if (!limit.success) return rateLimitResponse(limit);

    const parsed = validateUsername(usernameCheck);
    if (parsed.ok === false) {
      return NextResponse.json({ available: false, error: parsed.error }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

    const user = await verifyAuthHeader(request);
    const snap = await db.collection("usernames").doc(parsed.value).get();

    if (!snap.exists) {
      return NextResponse.json({ available: true });
    }

    const ownerUid = snap.data()?.uid as string | undefined;

    if (user) {
      const profileSnap = await db.collection("profiles").doc(user.uid).get();
      const profileUsername = profileSnap.data()?.username as string | undefined;
      if (profileUsername === parsed.value || ownerUid === user.uid) {
        return NextResponse.json({ available: true, owned: true });
      }
    }

    return NextResponse.json({ available: false }, { status: 409 });
  }

  const limit = await rateLimitByIp(request, "username-search", 60, "1 m");
  if (!limit.success) return rateLimitResponse(limit);

  const user = await verifyAuthHeader(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

  const prefix = normalizeUsername(q);
  try {
    const snap = await db
      .collection("usernames")
      .where(FieldPath.documentId(), ">=", prefix)
      .where(FieldPath.documentId(), "<=", prefix + "\uf8ff")
      .limit(12)
      .get();

    const results = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          uid: data.uid as string,
          username: d.id,
          displayName: (data.displayName as string) || d.id,
          photoURL: (data.avatarUrl as string) || null,
        };
      })
      .filter((r) => r.uid !== user.uid);

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

/** POST { username } — claim or change unique username. */
export async function POST(request: NextRequest) {
  const limit = await rateLimitByIp(request, "username-claim", 10, "1 m");
  if (!limit.success) return rateLimitResponse(limit);

  const user = await verifyAuthHeader(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

  let body: { username?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = validateUsername(body.username ?? "");
  if (parsed.ok === false) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const handle = parsed.value;
  const profileRef = db.collection("profiles").doc(user.uid);
  const handleRef = db.collection("usernames").doc(handle);

  try {
    await db.runTransaction(async (tx) => {
      const [profileSnap, handleSnap] = await Promise.all([
        tx.get(profileRef),
        tx.get(handleRef),
      ]);

      const profile = profileSnap.data() ?? {};
      const previous = (profile.username as string) || null;

      if (previous === handle) return;

      if (handleSnap.exists && handleSnap.data()?.uid !== user.uid) {
        throw new Error("TAKEN");
      }

      if (previous && previous !== handle) {
        tx.delete(db.collection("usernames").doc(previous));
      }

      tx.set(handleRef, {
        uid: user.uid,
        displayName: profile.display_name || user.email?.split("@")[0] || handle,
        avatarUrl: profile.avatar_url || null,
        updatedAt: Date.now(),
      });

      const displayName =
        (profile.display_name as string) ||
        user.email?.split("@")[0] ||
        handle;

      tx.set(
        profileRef,
        {
          username: handle,
          user_id: user.uid,
          display_name: displayName,
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      );
    });

    return NextResponse.json({ username: handle });
  } catch (err) {
    if (err instanceof Error && err.message === "TAKEN") {
      return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to save username" }, { status: 500 });
  }
}

/** HEAD ?username= — availability check (legacy; prefer GET). */
export async function HEAD(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("username") ?? "";
  const parsed = validateUsername(raw);
  if (!parsed.ok) {
    return new NextResponse(null, { status: 400 });
  }

  const db = getAdminDb();
  if (!db) return new NextResponse(null, { status: 503 });

  const user = await verifyAuthHeader(request);
  const snap = await db.collection("usernames").doc(parsed.value).get();

  if (!snap.exists) {
    return new NextResponse(null, { status: 204 });
  }

  const ownerUid = snap.data()?.uid as string | undefined;
  if (user && ownerUid === user.uid) {
    return new NextResponse(null, { status: 204 });
  }

  return new NextResponse(null, { status: 409 });
}
