"use client";

import { useState, useCallback, useEffect } from "react";
import { Search, UserPlus, Check, X, Users, Send, Loader2, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFriends, type Friend, type UserProfile } from "@/hooks/useFriends";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface FriendsListProps {
  inviteMode?: boolean;
  onInvite?: (friend: Friend) => void;
  invitingUserId?: string | null;
  variant?: "sidebar" | "page";
  initialTab?: "friends" | "requests" | "find";
}

export function FriendsList({
  inviteMode = false,
  onInvite,
  invitingUserId = null,
  variant = "sidebar",
  initialTab = "friends",
}: FriendsListProps) {
  const { toast } = useToast();
  const t = useTranslations("friends");
  const {
    friends,
    incomingRequests,
    loading,
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    getRelationship,
  } = useFriends();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"friends" | "requests" | "find">(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const shellClass =
    variant === "page"
      ? "glass-card rounded-2xl border border-white/10 overflow-hidden"
      : "flex flex-col flex-1 min-h-0 overflow-hidden";

  const handleSearch = useCallback(async () => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const results = await searchUsers(searchQuery);
    setSearchResults(results);
    setSearching(false);
  }, [searchQuery, searchUsers]);

  const handleSendRequest = useCallback(
    async (target: UserProfile) => {
      setSendingTo(target.uid);
      const result = await sendFriendRequest(target);
      setSendingTo(null);

      if (result === "sent") {
        toast({
          title: "Request sent",
          description: `${target.displayName} will get a notification.`,
        });
      } else if (result === "accepted") {
        toast({
          title: "You're now friends!",
          description: `You and ${target.displayName} are connected.`,
        });
        setSearchResults((prev) => prev.filter((u) => u.uid !== target.uid));
      } else if (result === "already_friends") {
        toast({ title: "Already friends", description: `You're already connected with ${target.displayName}.` });
      } else if (result === "already_sent") {
        toast({ title: "Request pending", description: `You already sent a request to ${target.displayName}.` });
      } else {
        toast({ title: "Could not send request", variant: "destructive" });
      }
    },
    [sendFriendRequest, toast]
  );

  const handleAccept = useCallback(
    async (req: Parameters<typeof acceptFriendRequest>[0]) => {
      await acceptFriendRequest(req);
      toast({
        title: "Friend added",
        description: `You and ${req.fromDisplayName} are now friends.`,
      });
    },
    [acceptFriendRequest, toast]
  );

  const renderActionButton = (u: UserProfile) => {
    const rel = getRelationship(u.uid);

    if (rel === "friend") {
      return (
        <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
          Friends
        </span>
      );
    }
    if (rel === "incoming") {
      return (
        <button
          type="button"
          onClick={() => {
            const req = incomingRequests.find((r) => r.fromUserId === u.uid);
            if (req) void handleAccept(req);
          }}
          className="flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-green-500 focus-ring"
        >
          <Check className="w-3 h-3" />
          Accept
        </button>
      );
    }
    if (rel === "outgoing") {
      return (
        <span className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-medium text-gray-400">
          <Clock className="w-3 h-3" />
          Pending
        </span>
      );
    }

    return (
      <button
        type="button"
        onClick={() => void handleSendRequest(u)}
        disabled={sendingTo === u.uid}
        className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-white/20 disabled:opacity-30 focus-ring"
      >
        {sendingTo === u.uid ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <UserPlus className="w-3 h-3" />
        )}
        Add
      </button>
    );
  };

  return (
    <div className={`${shellClass} ${variant === "sidebar" ? "flex h-full flex-col" : ""}`}>
      <div className="flex shrink-0 border-b border-white/10">
        {[
          { id: "friends" as const, label: t("friends"), count: friends.length },
          { id: "requests" as const, label: t("requests"), count: incomingRequests.length },
          { id: "find" as const, label: t("find"), icon: UserPlus },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-3 text-xs font-medium transition-colors focus-ring ${
              activeTab === tab.id
                ? "border-red-500 text-white"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab.icon && <tab.icon className="w-3.5 h-3.5" />}
            {tab.label}
            {"count" in tab && tab.count! > 0 && (
              <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-400">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className={`${variant === "sidebar" ? "flex-1 min-h-0 overflow-y-auto" : "min-h-[320px]"}`}>
        {activeTab === "friends" && (
          <div className="space-y-1 p-3">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
              </div>
            )}
            {!loading && friends.length === 0 && (
              <div className="py-8 text-center">
                <Users className="mx-auto mb-2 h-8 w-8 text-gray-700" />
                <p className="text-xs text-gray-500">{t("noFriends")}</p>
                <p className="mt-1 text-[10px] text-gray-600">{t("searchFindTab")}</p>
              </div>
            )}
            {friends.map((friend) => (
              <div
                key={friend.id}
                className="group flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-white/5"
              >
                {friend.avatarUrl ? (
                  <img
                    src={friend.avatarUrl}
                    alt={friend.displayName}
                    loading="lazy"
                    className="h-9 w-9 rounded-full object-cover ring-2 ring-white/15"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-orange-600 text-sm font-bold text-white">
                    {friend.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{friend.displayName}</p>
                  <p className="text-[10px] text-emerald-400/80">{inviteMode ? t("available") : ""}</p>
                </div>
                {inviteMode && onInvite && (
                  <button
                    type="button"
                    onClick={() => void onInvite(friend)}
                    disabled={invitingUserId === friend.userId}
                    className="flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-red-500 focus-ring disabled:opacity-50"
                  >
                    {invitingUserId === friend.userId ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                    {invitingUserId === friend.userId ? t("sending") : t("invite")}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === "requests" && (
          <div className="space-y-1 p-3">
            {incomingRequests.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-xs text-gray-500">No pending requests</p>
              </div>
            )}
            {incomingRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 p-2.5"
              >
                {req.fromAvatarUrl ? (
                  <img
                    src={req.fromAvatarUrl}
                    alt={req.fromDisplayName}
                    loading="lazy"
                    className="h-9 w-9 rounded-full object-cover ring-2 ring-white/15"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 text-sm font-bold text-white">
                    {req.fromDisplayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{req.fromDisplayName}</p>
                  <p className="text-[10px] text-gray-500">wants to be friends</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleAccept(req)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-500/20 text-green-400 transition-colors hover:bg-green-500/30 focus-ring"
                    aria-label="Accept"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void declineFriendRequest(req)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/20 text-red-400 transition-colors hover:bg-red-500/30 focus-ring"
                    aria-label="Decline"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "find" && (
          <div className="p-3">
            <div className="mb-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
                  placeholder="Search by username..."
                  className="focus-ring w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-8 pr-3 text-xs text-white placeholder:text-gray-600 focus:border-white/20"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleSearch()}
                disabled={searchQuery.length < 2 || searching}
                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-30 focus-ring"
              >
                {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Search"}
              </button>
            </div>

            <div className="space-y-1">
              {searchResults.map((u) => (
                <div
                  key={u.uid}
                  className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-white/5"
                >
                  {u.photoURL ? (
                    <img
                      src={u.photoURL}
                      alt={u.displayName}
                      loading="lazy"
                      className="h-9 w-9 rounded-full object-cover ring-2 ring-white/15"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-600 text-sm font-bold text-white">
                      {u.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{u.displayName}</p>
                    {u.username && (
                      <p className="truncate text-[11px] text-gray-500">@{u.username}</p>
                    )}
                  </div>
                  {renderActionButton(u)}
                </div>
              ))}
              {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                <p className="py-4 text-center text-xs text-gray-500">No users found</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
