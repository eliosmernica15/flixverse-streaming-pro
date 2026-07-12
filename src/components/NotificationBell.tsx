"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  Trash2,
  MessageCircle,
  Heart,
  UserPlus,
  Star,
  Tv,
  PartyPopper,
  UserCheck,
  X,
} from "lucide-react";
import { useAppNotifications } from "@/hooks/useAppNotifications";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfileContext } from "@/contexts/UserProfileContext";
import { Notification } from "@/integrations/firebase/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  declineWatchPartyInvite,
} from "@/lib/notifications/partyInvite";
import { executeGuestJoin } from "@/lib/party/executeGuestJoin";

const NotificationIcon = ({ type }: { type: Notification["type"] }) => {
  switch (type) {
    case "like":
      return <Heart className="h-4 w-4 text-red-400" />;
    case "comment":
      return <MessageCircle className="h-4 w-4 text-blue-400" />;
    case "follow":
      return <UserPlus className="h-4 w-4 text-green-400" />;
    case "friend_request":
      return <UserPlus className="h-4 w-4 text-emerald-400" />;
    case "friend_accepted":
      return <UserCheck className="h-4 w-4 text-green-400" />;
    case "watch_party_invite":
      return <PartyPopper className="h-4 w-4 text-purple-400" />;
    case "watch_party_invite_declined":
      return <X className="h-4 w-4 text-orange-400" />;
    case "review":
      return <Star className="h-4 w-4 text-yellow-400" />;
    case "new_episode":
      return <Tv className="h-4 w-4 text-purple-400" />;
    default:
      return <Bell className="h-4 w-4 text-gray-400" />;
  }
};

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

function isPendingPartyInvite(notification: Notification) {
  return (
    notification.type === "watch_party_invite" &&
    !notification.read &&
    notification.data?.invite_status !== "accepted" &&
    notification.data?.invite_status !== "declined"
  );
}

const NotificationItem = ({
  notification,
  onRead,
  onDelete,
  onOpen,
  onAcceptParty,
  onDeclineParty,
  partyActionLoading,
}: {
  notification: Notification;
  onRead: () => void;
  onDelete: () => void;
  onOpen: () => void;
  onAcceptParty?: () => void;
  onDeclineParty?: () => void;
  partyActionLoading?: boolean;
}) => {
  const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
    return date.toLocaleDateString();
  };

  const href = getNotificationHref(notification);
  const showPartyActions = isPendingPartyInvite(notification);

  return (
    <div
      role={href && !showPartyActions ? "button" : undefined}
      tabIndex={href && !showPartyActions ? 0 : undefined}
      onClick={() => {
        if (showPartyActions) return;
        if (!notification.read) onRead();
        if (href) onOpen();
      }}
      onKeyDown={(e) => {
        if (showPartyActions) return;
        if (href && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          if (!notification.read) onRead();
          onOpen();
        }
      }}
      className={`rounded-xl p-3 transition-colors ${
        notification.read
          ? "bg-transparent hover:bg-white/5"
          : "bg-white/5 hover:bg-white/10"
      } ${href && !showPartyActions ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-start space-x-3">
        <div
          className={`mt-0.5 rounded-full p-2 ${notification.read ? "bg-gray-800" : "bg-white/10"}`}
        >
          <NotificationIcon type={notification.type} />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-medium ${notification.read ? "text-gray-400" : "text-white"}`}
          >
            {notification.title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{notification.message}</p>
          <p className="mt-1 text-[10px] text-gray-600">{timeAgo(notification.created_at)}</p>

          {showPartyActions && (
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                disabled={partyActionLoading}
                onClick={(e) => {
                  e.stopPropagation();
                  onAcceptParty?.();
                }}
                className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Join party
              </button>
              <button
                type="button"
                disabled={partyActionLoading}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeclineParty?.();
                }}
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-gray-300 transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-1">
          {!notification.read && !showPartyActions && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRead();
              }}
              className="rounded-lg p-1.5 transition-colors hover:bg-white/10 focus-ring"
              title="Mark as read"
            >
              <Check className="h-3.5 w-3.5 text-green-400" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded-lg p-1.5 transition-colors hover:bg-red-500/20 focus-ring"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5 text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );
};

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [partyActionId, setPartyActionId] = useState<string | null>(null);
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    refresh,
  } = useAppNotifications();
  const { user, isAuthenticated } = useAuth();
  const { profile } = useUserProfileContext();

  const myName =
    profile?.display_name || user?.displayName || user?.email?.split("@")[0] || "You";

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  if (!isAuthenticated) {
    return null;
  }

  const handleOpenNotification = (notification: Notification) => {
    const href = getNotificationHref(notification);
    if (!href) return;
    setOpen(false);
    if (href.startsWith("http")) {
      window.location.href = href;
    } else {
      router.push(href);
    }
  };

  const handleAcceptParty = async (notification: Notification) => {
    if (!user) return;
    setPartyActionId(notification.id);
    try {
      setOpen(false);
      await executeGuestJoin({
        notification,
        user: { displayName: user.displayName, photoURL: user.photoURL },
      });
    } catch (err) {
      console.error("[party-invite] accept failed:", err);
    } finally {
      setPartyActionId(null);
    }
  };

  const handleDeclineParty = async (notification: Notification) => {
    if (!user) return;
    setPartyActionId(notification.id);
    try {
      await declineWatchPartyInvite(notification, user.uid, myName);
    } catch (err) {
      console.error("[party-invite] decline failed:", err);
    } finally {
      setPartyActionId(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="group relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10 focus-ring glow-hover">
          <Bell className="h-5 w-5 transition-transform group-hover:scale-110" />
          {unreadCount > 0 && (
            <span className="badge-shine absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-red-500 to-red-600 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(239,68,68,0.6)]">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="glass-strong w-[min(20rem,calc(100vw-1rem))] animate-scale-in rounded-2xl border-white/10 p-0 shadow-2xl shadow-black/50"
      >
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h3 className="font-semibold text-white">Notifications</h3>
          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-7 px-2 text-xs text-gray-400 hover:text-white"
              >
                <Check className="mr-1 h-3 w-3" />
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-7 px-2 text-xs text-red-400 hover:text-red-300"
              >
                <Trash2 className="mr-1 h-3 w-3" />
                Clear
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="scrollbar-thin h-80">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500/30 border-t-red-500" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center text-gray-500">
              <Bell className="mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={() => void markAsRead(notification.id)}
                  onDelete={() => void deleteNotification(notification.id)}
                  onOpen={() => handleOpenNotification(notification)}
                  onAcceptParty={() => void handleAcceptParty(notification)}
                  onDeclineParty={() => void handleDeclineParty(notification)}
                  partyActionLoading={partyActionId === notification.id}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
