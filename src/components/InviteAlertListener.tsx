"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast as sonnerToast } from "sonner";
import { useAppNotifications } from "@/hooks/useAppNotifications";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfileContext } from "@/contexts/UserProfileContext";
import type { Notification } from "@/integrations/firebase/types";
import {
  declineWatchPartyInvite,
} from "@/lib/notifications/partyInvite";
import { executeGuestJoin } from "@/lib/party/executeGuestJoin";
import { pythonFetch } from "@/lib/pythonApi/client";
import { useNotifications } from "@/hooks/useNotifications";

const SEEN_KEY = "flixverse_seen_notification_toasts";

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
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-200)));
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

function getNotificationIcon(type: Notification["type"]): string {
  switch (type) {
    case "like": return "❤️";
    case "comment": return "💬";
    case "follow": return "👤";
    case "friend_request": return "🤝";
    case "friend_accepted": return "✅";
    case "watch_party_invite": return "🎉";
    case "watch_party_invite_declined": return "❌";
    case "review": return "⭐";
    case "new_episode": return "📺";
    case "recommendation": return "🎯";
    default: return "🔔";
  }
}

function getNotificationHref(notification: Notification): string | null {
  const data = notification.data;
  if (notification.type === "friend_request") {
    return "/profile?tab=friends&friendsTab=requests";
  }
  if (notification.type === "friend_accepted") {
    return "/profile?tab=friends";
  }
  if (
    notification.type === "watch_party_invite" &&
    data?.invite_status !== "accepted" &&
    data?.invite_status !== "declined" &&
    !notification.read
  ) {
    return null;
  }
  if (notification.type === "watch_party_invite" && data?.party_join_url) {
    return data.party_join_url;
  }
  if (notification.type === "watch_party_invite" && data?.content_id) {
    const type = data.content_type || "movie";
    return `/movie/${data.content_id}?type=${type}`;
  }
  if (data?.content_id) {
    return `/movie/${data.content_id}?type=${data.content_type || "movie"}`;
  }
  return null;
}

export default function InviteAlertListener() {
  const { notifications, loading } = useAppNotifications();
  const { user, isAuthenticated } = useAuth();
  const { profile } = useUserProfileContext();
  const { preferences } = useNotifications();
  const router = useRouter();
  const seenRef = useRef<Set<string>>(loadSeen());
  const channelPrefsRef = useRef<{
    email_enabled: boolean;
    push_enabled: boolean;
    in_app_enabled: boolean;
    channel_prefs: Record<string, { email: boolean; push: boolean; in_app: boolean }>;
  } | null>(null);

  // Load channel preferences
  useEffect(() => {
    if (!isAuthenticated) return;
    const loadPrefs = async () => {
      try {
        const data = await pythonFetch<{
          email_enabled: boolean;
          push_enabled: boolean;
          in_app_enabled: boolean;
          channel_prefs: Record<string, { email: boolean; push: boolean; in_app: boolean }>;
        }>("/notifications/preferences");
        channelPrefsRef.current = data;
      } catch (err) {
        console.error("[InviteAlertListener] Failed to load channel preferences:", err);
      }
    };
    loadPrefs();
  }, [isAuthenticated]);

  const myName =
    profile?.display_name || user?.displayName || user?.email?.split("@")[0] || "You";

  const shouldShowInAppToast = (notification: Notification): boolean => {
    // Always show in-app toasts for party invites and friend requests (high priority)
    if (
      notification.type === "watch_party_invite" ||
      notification.type === "friend_request"
    ) {
      return true;
    }
    // Check channel preferences for other types
    if (!channelPrefsRef.current?.in_app_enabled) return false;
    const typePrefs = channelPrefsRef.current?.channel_prefs[notification.type];
    if (typePrefs && typePrefs.in_app === false) return false;
    return true;
  };

  // Handle party invites
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
        icon: getNotificationIcon(notification.type),
        action: {
          label: "Join party",
          onClick: () => {
            void (async () => {
              try {
                await executeGuestJoin({
                  notification,
                  user: { displayName: user.displayName, photoURL: user.photoURL },
                });
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

  // Handle friend requests
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
        icon: getNotificationIcon(notification.type),
        action: {
          label: "View",
          onClick: () => router.push("/profile?tab=friends&friendsTab=requests"),
        },
      });
    }
  }, [notifications, loading, isAuthenticated, user, router]);

  // Handle all other notification types with in-app toasts
  useEffect(() => {
    if (!isAuthenticated || !user || loading) return;

    for (const notification of notifications) {
      // Skip party invites and friend requests (handled above)
      if (isPendingPartyInvite(notification)) continue;
      if (notification.type === "friend_request") continue;
      // Skip already read notifications
      if (notification.read) continue;
      // Check if we should show in-app toast for this type
      if (!shouldShowInAppToast(notification)) continue;
      // Skip if already seen
      if (seenRef.current.has(`toast-${notification.id}`)) continue;

      seenRef.current.add(`toast-${notification.id}`);
      saveSeen(seenRef.current);

      const href = getNotificationHref(notification);
      const icon = getNotificationIcon(notification.type);

      // Build toast options
      const toastOptions: {
        description: string;
        duration: number;
        icon: string;
        action?: { label: string; onClick: () => void };
      } = {
        description: notification.message,
        duration: 8000,
        icon,
      };

      // Add action button if there's a navigable href
      if (href) {
        toastOptions.action = {
          label: "View",
          onClick: () => {
            if (href.startsWith("http")) {
              window.location.href = href;
            } else {
              router.push(href);
            }
          },
        };
      }

      sonnerToast(notification.title, toastOptions);
    }
  }, [notifications, loading, isAuthenticated, user, router]);

  return null;
}