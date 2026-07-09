import { getFirestore, collection, addDoc } from "firebase/firestore";

export type PendingJobType = "follow_notify" | "activity_review";

export async function enqueuePendingJob(
  requestedBy: string,
  type: PendingJobType,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const db = getFirestore();
    await addDoc(collection(db, "pending_jobs"), {
      type,
      status: "pending",
      requestedBy,
      payload,
      createdAt: Date.now(),
    });
  } catch (err) {
    console.warn("Failed to enqueue pending job:", err);
  }
}
