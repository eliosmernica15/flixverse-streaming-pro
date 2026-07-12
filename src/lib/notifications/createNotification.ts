import { addDoc, collection } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/integrations/firebase/client";
import type { Notification } from "@/integrations/firebase/types";
import { enqueuePendingJob } from "@/lib/pendingJobs";

const SOCIAL_TYPES: Notification["type"][] = [
  "friend_request",
  "friend_accepted",
  "watch_party_invite",
  "watch_party_invite_declined",
  "follow",
];

async function getIdToken(): Promise<string | null> {
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

async function dispatchViaApi(params: {
  recipientId: string;
  senderId: string;
  senderName: string;
  type: Notification["type"];
  title: string;
  message: string;
  data?: Notification["data"];
}): Promise<"ok" | "fallback" | "failed"> {
  const token = await getIdToken();
  if (!token) return "fallback";

  try {
    const res = await fetch("/api/notifications/dispatch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        recipientId: params.recipientId,
        type: params.type,
        title: params.title,
        message: params.message,
        senderName: params.senderName,
        data: params.data,
      }),
    });

    if (res.ok) return "ok";

    const payload = (await res.json().catch(() => ({}))) as { fallback?: string };
    if (res.status === 503 || res.status === 500 || payload.fallback === "pending_job") {
      return "fallback";
    }

    console.error("[notifications] API dispatch failed:", res.status, payload);
    return "failed";
  } catch (err) {
    console.warn("[notifications] API unreachable, using job queue:", err);
    return "fallback";
  }
}

async function dispatchViaJobQueue(params: {
  recipientId: string;
  senderId: string;
  senderName: string;
  type: Notification["type"];
  title: string;
  message: string;
  data?: Notification["data"];
}): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) return false;

  try {
    await enqueuePendingJob(params.senderId, "social_notify", {
      recipientId: params.recipientId,
      type: params.type,
      title: params.title,
      message: params.message,
      senderName: params.senderName,
      data: params.data ?? {},
    });
    return true;
  } catch (err) {
    console.error("[notifications] job enqueue failed:", err);
    return false;
  }
}

/** Secure notification dispatch: verified API (Admin SDK) with job-queue fallback. */
export async function sendNotificationToUser(params: {
  recipientId: string;
  senderId: string;
  senderName: string;
  type: Notification["type"];
  title: string;
  message: string;
  data?: Notification["data"];
}): Promise<boolean> {
  if (params.recipientId === params.senderId) return false;

  if (!SOCIAL_TYPES.includes(params.type)) {
    console.error("[notifications] unsupported type for secure dispatch:", params.type);
    return false;
  }

  const viaApi = await dispatchViaApi(params);
  if (viaApi === "ok") return true;
  if (viaApi === "failed") return false;

  return dispatchViaJobQueue(params);
}
