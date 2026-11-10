"use client";

import { useState, useCallback } from "react";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfileContext } from "@/contexts/UserProfileContext";
import { sendNotificationToUser } from "@/lib/notifications/createNotification";

export interface PartyInvite {
  id: string;
  roomId: string;
  fromUserId: string;
  fromDisplayName: string;
  fromAvatarUrl: string | null;
  toUserId: string;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
  respondedAt?: number;
  contentType?: "movie" | "tv";
  contentId?: number;
  contentTitle?: string;
}

export interface CreateInviteParams {
  roomId: string;
  toUserId: string;
  contentType?: "movie" | "tv";
  contentId?: number;
  contentTitle?: string;
}

interface UsePartyInvitesResult {
  createInvite: (params: CreateInviteParams) => Promise<string | null>;
  creating: Record<string, boolean>;
}

export function usePartyInvites(): UsePartyInvitesResult {
  const { user } = useAuth();
  const { profile } = useUserProfileContext();
  const [creating, setCreating] = useState<Record<string, boolean>>({});

  const createInvite = useCallback(
    async (params: CreateInviteParams): Promise<string | null> => {
      if (!user || !profile) return null;

      const { roomId, toUserId, contentType, contentId, contentTitle } = params;

      if (user.uid === toUserId) return null;

      // Set optimistic creating state
      setCreating((prev) => ({ ...prev, [toUserId]: true }));

      try {
        const db = getFirestore();

        // Verify the room exists and user is a participant
        const roomRef = doc(db, "flix_parties", roomId);
        const roomSnap = await getDoc(roomRef);

        if (!roomSnap.exists()) {
          throw new Error("Room not found");
        }

        const roomData = roomSnap.data();
        if (!roomData.participantIds?.includes(user.uid)) {
          throw new Error("Not a participant of this room");
        }

        // Create the invite document
        const inviteRef = await addDoc(collection(db, "watch_party_invites"), {
          roomId,
          fromUserId: user.uid,
          fromDisplayName: profile.display_name || user.displayName || "Unknown",
          fromAvatarUrl: profile.avatar_url || user.photoURL || null,
          toUserId,
          status: "pending",
          createdAt: Date.now(),
          contentType,
          contentId,
          contentTitle,
        });

        // Send notification to the invited user
        await sendNotificationToUser({
          recipientId: toUserId,
          senderId: user.uid,
          senderName: profile.display_name || user.displayName || "Someone",
          type: "watch_party_invite",
          title: "Watch Party Invite",
          message: `${profile.display_name || user.displayName || "Someone"} invited you to a watch party${
            contentTitle ? ` for "${contentTitle}"` : ""
          }`,
          data: {
            from_user_id: user.uid,
            from_user_name: profile.display_name || user.displayName || "Someone",
            invite_id: inviteRef.id,
            room_id: roomId,
            content_type: contentType,
            content_id: contentId,
            movie_title: contentTitle,
          },
        });

        return inviteRef.id;
      } catch (err) {
        console.error("[usePartyInvites] createInvite failed:", err);
        return null;
      } finally {
        setCreating((prev) => ({ ...prev, [toUserId]: false }));
      }
    },
    [user, profile]
  );

  return { createInvite, creating };
}