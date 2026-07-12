import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthHeader } from "@/lib/firebase/verifyAuth";
import { rateLimitByIp, rateLimitResponse } from "@/lib/rateLimitServer";
import type { Notification } from "@/integrations/firebase/types";

export const runtime = "nodejs";

const ALLOWED_TYPES: Notification["type"][] = [
  "friend_request",
  "friend_accepted",
  "watch_party_invite",
  "watch_party_invite_declined",
  "follow",
];

type DispatchBody = {
  recipientId?: string;
  type?: Notification["type"];
  title?: string;
  message?: string;
  senderName?: string;
  data?: Notification["data"];
};

export async function POST(request: NextRequest) {
  const limit = await rateLimitByIp(request, "notification-dispatch", 60, "1 m");
  if (!limit.success) return rateLimitResponse(limit);

  const user = await verifyAuthHeader(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: DispatchBody;
  try {
    body = (await request.json()) as DispatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { recipientId, type, title, message, senderName, data } = body;

  if (!recipientId || typeof recipientId !== "string") {
    return NextResponse.json({ error: "recipientId required" }, { status: 400 });
  }
  if (!type || !ALLOWED_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid notification type" }, { status: 400 });
  }
  if (!title?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "title and message required" }, { status: 400 });
  }
  if (recipientId === user.uid) {
    return NextResponse.json({ error: "Cannot notify yourself" }, { status: 400 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured", fallback: "pending_job" }, { status: 503 });
  }

  try {
    await db.collection("notifications").add({
      user_id: recipientId,
      from_user_id: user.uid,
      type,
      title: title.trim(),
      message: message.trim(),
      data: {
        ...data,
        from_user_id: user.uid,
        from_user_name: senderName || data?.from_user_name || "Someone",
      },
      read: false,
      created_at: new Date().toISOString(),
      dispatched_by: "api",
      dispatched_at: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[notifications/dispatch]", err);
    return NextResponse.json({ error: "Dispatch failed", fallback: "pending_job" }, { status: 500 });
  }
}
