import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import type { UserProfile } from "@/integrations/firebase/types";

export function hasUsername(profile: Pick<UserProfile, "username"> | null | undefined): boolean {
  return typeof profile?.username === "string" && profile.username.trim().length > 0;
}

/** Reverse lookup: find handle owned by uid in the usernames index. */
export async function lookupUsernameByUid(db: Firestore, uid: string): Promise<string | null> {
  try {
    const snap = await getDocs(
      query(collection(db, "usernames"), where("uid", "==", uid), limit(1))
    );
    if (snap.empty) return null;
    return snap.docs[0].id;
  } catch {
    return null;
  }
}

/** Backfill profiles.username when the index exists but the profile doc is missing the field. */
export async function backfillProfileUsername(
  db: Firestore,
  uid: string,
  username: string
): Promise<void> {
  try {
    await updateDoc(doc(db, "profiles", uid), {
      username,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Non-fatal — profile may not exist yet
  }
}
