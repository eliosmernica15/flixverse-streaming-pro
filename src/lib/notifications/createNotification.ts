import { addDoc, collection } from "firebase/firestore";
import { getFirebaseDb } from "@/integrations/firebase/client";
import type { Notification } from "@/integrations/firebase/types";

export async function sendNotificationToUser(params: {
  recipientId: string;
  senderId: string;
  senderName: string;
  type: Notification["type"];
  title: string;
  message: string;
  data?: Notification["data"];
}): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) {
    console.error("[notifications] Firebase not configured");
    return false;
  }

  if (params.recipientId === params.senderId) return false;

  try {
    await addDoc(collection(db, "notifications"), {
      user_id: params.recipientId,
      from_user_id: params.senderId,
      type: params.type,
      title: params.title,
      message: params.message,
      data: {
        ...params.data,
        from_user_id: params.senderId,
        from_user_name: params.senderName,
      },
      read: false,
      created_at: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[notifications] send failed:", message, err);
    return false;
  }
}
