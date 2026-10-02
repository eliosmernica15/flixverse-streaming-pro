import {
  doc,
  getDoc,
  runTransaction,
  type Firestore,
} from "firebase/firestore";
import { validateUsername } from "@/lib/username";

export type UsernameAvailability = "available" | "taken" | "owned" | "unknown";

export async function checkUsernameAvailability(
  db: Firestore,
  handle: string,
  uid: string
): Promise<UsernameAvailability> {
  const snap = await getDoc(doc(db, "usernames", handle));
  if (!snap.exists()) return "available";
  const ownerUid = snap.data()?.uid as string | undefined;
  if (ownerUid === uid) return "owned";
  return "taken";
}

export async function claimUsername(
  db: Firestore,
  uid: string,
  raw: string,
  profile: { display_name?: string | null; avatar_url?: string | null; username?: string | null },
  email?: string | null
): Promise<{ ok: true; username: string } | { ok: false; error: string }> {
  const parsed = validateUsername(raw);
  if (parsed.ok === false) {
    return { ok: false, error: parsed.error };
  }

  const handle = parsed.value;
  if (profile.username === handle) {
    return { ok: true, username: handle };
  }

  try {
    await runTransaction(db, async (tx) => {
      const handleRef = doc(db, "usernames", handle);
      const profileRef = doc(db, "profiles", uid);

      const [handleSnap, profileSnap] = await Promise.all([
        tx.get(handleRef),
        tx.get(profileRef),
      ]);

      const previous = (profileSnap.data()?.username as string | undefined) || null;

      if (handleSnap.exists()) {
        const ownerUid = handleSnap.data()?.uid as string | undefined;
        if (ownerUid !== uid) {
          throw new Error("TAKEN");
        }
        if (previous === handle) return;
      }

      if (previous && previous !== handle) {
        tx.delete(doc(db, "usernames", previous));
      }

      const displayName =
        profileSnap.data()?.display_name ||
        profile.display_name ||
        email?.split("@")[0] ||
        handle;

      tx.set(handleRef, {
        uid,
        displayName,
        avatarUrl: profileSnap.data()?.avatar_url || profile.avatar_url || null,
        updatedAt: Date.now(),
      });

      tx.set(
        profileRef,
        {
          username: handle,
          user_id: uid,
          display_name: displayName,
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      );
    });

    return { ok: true, username: handle };
  } catch (err) {
    if (err instanceof Error && err.message === "TAKEN") {
      return { ok: false, error: "Username is already taken" };
    }
    const code = (err as { code?: string })?.code;
    if (code === "permission-denied") {
      return {
        ok: false,
        error: "Permission denied. Sign out and back in, then try again.",
      };
    }
    return { ok: false, error: "Could not save username. Please try again." };
  }
}
