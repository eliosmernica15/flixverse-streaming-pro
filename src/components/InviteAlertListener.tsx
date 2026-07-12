"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast as sonnerToast } from "sonner";
import { useFirebaseNotifications } from "@/hooks/useNotificationsFirebase";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfileContext } from "@/contexts/UserProfileContext";
import type { Notification } from "@/integrations/firebase/types";
import {
  acceptWatchPartyInvite,
  declineWatchPartyInvite,
} from "@/lib/notifications/partyInvite";

const SEEN_KEY = "flixverse_seen_invite_toasts";

function loadSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveSeen(seen: Set<string>) {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-100)));
  } catch {
    /* ignore quota */
  }
}

function isPendingPartyInvite(n: Notification) {
  return (
    n.type === "watch_party_invite" &&
    !n.read &&
    n.data?.invite_status !== "accepted" &&
    n.data?.invite_status !== "declined"
  );
}

export default function InviteAlertListener() {
  const { notifications, loading } = useFirebaseNotifications();
  const { user, isAuthenticated } = useAuth();
  const { profile } = useUserProfileContext();
  const router = useRouter();
  const seenRef = useRef<Set<string>>(loadSeen());

  const myName =
    profile?.display_name || user?.displayName || user?.email?.split("@")[0] || "You";

  useEffect(() => {
    if (!isAuthenticated || !user || loading) return;

    for (const notification of notifications) {
      if (!isPendingPartyInvite(notification)) continue;
      if (seenRef.current.has(notification.id)) continue;

      seenRef.current.add(notification.id);
      saveSeen(seenRef.current);

      const movieTitle = notification.data?.movie_title || "a movie";

      sonnerToast(notification.title, {
        description: notification.message || `${notification.data?.from_user_name} invited you to watch "${movieTitle}"`,
        duration: 20000,
        action: {
          label: "Join party",
          onClick: () => {
            void (async () => {
              try {
                const joinUrl = await acceptWatchPartyInvite(notification);
                if (joinUrl) {
                  if (joinUrl.startsWith("http")) {
                    window.location.href = joinUrl;
                  } else {
                    router.push(joinUrl);
                  }
                } else {
                  sonnerToast.error("Could not open party link");
                }
              } catch (err) {
                console.error("[party-invite] accept failed:", err);
                sonnerToast.error("Could not join party");
              }
            })();
          },
        },
        cancel: {
          label: "Decline",
          onClick: () => {
            void (async () => {
              try {
                await declineWatchPartyInvite(notification, user.uid, myName);
                sonnerToast.message("Invite declined");
              } catch (err) {
                console.error("[party-invite] decline failed:", err);
                sonnerToast.error("Could not decline invite");
              }
            })();
          },
        },
      });
    }
  }, [notifications, loading, isAuthenticated, user, myName, router]);

  useEffect(() => {
    if (!isAuthenticated || !user || loading) return;

    for (const notification of notifications) {
      if (notification.type !== "friend_request" || notification.read) continue;
      if (seenRef.current.has(`fr-${notification.id}`)) continue;

      seenRef.current.add(`fr-${notification.id}`);
      saveSeen(seenRef.current);

      sonnerToast(notification.title, {
        description: notification.message,
        duration: 12000,
        action: {
          label: "View",
          onClick: () => router.push("/profile?tab=friends&friendsTab=requests"),
        },
      });
    }
  }, [notifications, loading, isAuthenticated, user, router]);

  return null;
}
