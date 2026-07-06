"use client";

import { useState, useCallback } from "react";
import { Search, UserPlus, Check, X, Users, Send, Loader2 } from "lucide-react";
import { useFriends, type Friend, type UserProfile } from "@/hooks/useFriends";
import { useAuth } from "@/hooks/useAuth";

interface FriendsListProps {
  /** Show invite buttons for current content */
  inviteMode?: boolean;
  onInvite?: (friend: Friend) => void;
}

export function FriendsList({ inviteMode = false, onInvite }: FriendsListProps) {
  const { user } = useAuth();
  const {
    friends,
    incomingRequests,
    loading,
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
  } = useFriends();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"friends" | "requests" | "find">("friends");

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

  const handleSendRequest = useCallback(async (target: UserProfile) => {
    setSendingTo(target.uid);
    await sendFriendRequest(target);
    setSendingTo(null);
    setSearchResults((prev) => prev.filter((u) => u.uid !== target.uid));
  }, [sendFriendRequest]);

  const handleInvite = useCallback((friend: Friend) => {
    if (onInvite) onInvite(friend);
  }, [onInvite]);

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-white/10 shrink-0">
        {[
          { id: "friends" as const, label: "Friends", count: friends.length },
          { id: "requests" as const, label: "Requests", count: incomingRequests.length },
          { id: "find" as const, label: "Find", icon: UserPlus },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? "text-white border-red-500"
                : "text-gray-500 border-transparent hover:text-gray-300"
            }`}
          >
            {tab.icon && <tab.icon className="w-3.5 h-3.5" />}
            {tab.label}
            {"count" in tab && tab.count! > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Friends list */}
        {activeTab === "friends" && (
          <div className="p-3 space-y-1">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
              </div>
            )}
            {!loading && friends.length === 0 && (
              <div className="text-center py-8">
                <Users className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No friends yet</p>
                <p className="text-[10px] text-gray-600 mt-1">Search to add friends</p>
              </div>
            )}
            {friends.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors group"
              >
                {friend.avatarUrl ? (
                  <img src={friend.avatarUrl} alt={friend.displayName} className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-sm font-bold text-white">
                    {friend.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{friend.displayName}</p>
                </div>
                {inviteMode && (
                  <button
                    onClick={() => handleInvite(friend)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-[11px] font-semibold text-white transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Send className="w-3 h-3" />
                    Invite
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Incoming requests */}
        {activeTab === "requests" && (
          <div className="p-3 space-y-1">
            {incomingRequests.length === 0 && (
              <div className="text-center py-8">
                <p className="text-xs text-gray-500">No pending requests</p>
              </div>
            )}
            {incomingRequests.map((req) => (
              <div key={req.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/5">
                {req.fromAvatarUrl ? (
                  <img src={req.fromAvatarUrl} alt={req.fromDisplayName} className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-sm font-bold text-white">
                    {req.fromDisplayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{req.fromDisplayName}</p>
                  <p className="text-[10px] text-gray-500">wants to be friends</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => acceptFriendRequest(req)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                    aria-label="Accept"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => declineFriendRequest(req)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                    aria-label="Decline"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Find friends */}
        {activeTab === "find" && (
          <div className="p-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search by username..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-white/20"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searchQuery.length < 2 || searching}
                className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-30 text-xs font-semibold text-white transition-colors"
              >
                {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Search"}
              </button>
            </div>

            <div className="space-y-1">
              {searchResults.map((u) => (
                <div key={u.uid} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors">
                  {u.photoURL ? (
                    <img src={u.photoURL} alt={u.displayName} className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-sm font-bold text-white">
                      {u.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{u.displayName}</p>
                  </div>
                  <button
                    onClick={() => handleSendRequest(u)}
                    disabled={sendingTo === u.uid}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-medium text-white transition-colors disabled:opacity-30"
                  >
                    {sendingTo === u.uid ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <UserPlus className="w-3 h-3" />
                    )}
                    Add
                  </button>
                </div>
              ))}
              {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                <p className="text-center text-xs text-gray-500 py-4">No users found</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
