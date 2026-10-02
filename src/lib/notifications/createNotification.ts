import type { Notification } from "@/integrations/firebase/types";
import { isPythonBackendEnabled } from "@/lib/pythonApi/config";
import { pythonFetch } from "@/lib/pythonApi/client";
import { enqueuePendingJob } from "@/lib/pendingJobs";
import { getFirebaseAuth } from "@/integrations/firebase/client";

const SOCIAL_TYPES: Notification["type"][] = [
  "friend_request",
  "friend_accepted",
  "watch_party_invite",
  "watch_party_invite_declined",
  "follow",
];

async function dispatchViaPython(params: {
  recipientId: string;
  senderId: string;
  senderName: string;
  type: Notification["type"];
  title: string;
  message: string;
  data?: Notification["data"];
}): Promise<boolean> {
  try {
    await pythonFetch("/notifications/dispatch", {
      method: "POST",
      body: JSON.stringify({
        recipientId: params.recipientId,
        type: params.type,
        title: params.title,
        message: params.message,
        senderName: params.senderName,
        data: params.data,
      }),
    });
    return true;
  } catch (err) {
    console.error("[notifications/python] dispatch failed:", err);
    return false;
  }
}

async function dispatchViaNextApi(params: {
  recipientId: string;
  senderName: string;
  type: Notification["type"];
  title: string;
  message: string;
  data?: Notification["data"];
}): Promise<"ok" | "fallback" | "failed"> {
  const auth = getFirebaseAuth();
  const token = await auth?.currentUser?.getIdToken();
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
    if (res.status === 503 || res.status === 500) return "fallback";
    return "failed";
  } catch {
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
  } catch {
    return false;
  }
}

/** Secure notification dispatch — Python SQLite API (preferred), then Admin API, then job queue. */
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
  if (!SOCIAL_TYPES.includes(params.type)) return false;

  if (isPythonBackendEnabled()) {
    return dispatchViaPython(params);
  }

  const viaApi = await dispatchViaNextApi(params);
  if (viaApi === "ok") return true;
  if (viaApi === "failed") return false;
  return dispatchViaJobQueue(params);
}
