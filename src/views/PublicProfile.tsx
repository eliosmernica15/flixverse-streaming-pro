"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Film, Tv, Star, Activity, UserPlus, UserCheck, Users } from "lucide-react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { getFirestore, collection, query, where, getDocs, limit, orderBy } from "firebase/firestore";
import { MemberProfile, ActivityFeedItem } from "@/integrations/firebase/types";
import { useAuth } from "@/hooks/useAuth";
import { useFollow } from "@/hooks/useFollow";
import { useToast } from "@/hooks/use-toast";
import MovieCard from "@/components/MovieCard";
import SectionHeader from "@/components/SectionHeader";
import Reveal from "@/components/Reveal";
import { TMDBMovie } from "@/utils/tmdbApi";

interface PublicProfileProps {
  username: string;
}

export default function PublicProfile({ username }: PublicProfileProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [watchlist, setWatchlist] = useState<TMDBMovie[]>([]);
  const [activity, setActivity] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const { isFollowing, followerCount, toggleFollow } = useFollow(profile?.ownerId ?? null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const db = getFirestore();
        const profilesRef = collection(db, "member_profiles");
        const q = query(profilesRef, where("displayName", "==", username), limit(1));
        const snap = await getDocs(q);

        if (snap.empty) {
          setLoading(false);
          return;
        }

        const doc = snap.docs[0];
        const data = doc.data() as MemberProfile;
        setProfile({ ...data, id: doc.id });

        // Load public watchlist
        const listsRef = collection(db, "user_movie_lists");
        const listQ = query(listsRef, where("user_id", "==", data.ownerId), limit(20));
        const listSnap = await getDocs(listQ);
        const items: TMDBMovie[] = [];
        listSnap.forEach((d) => {
          const item = d.data();
          items.push({
            id: item.movie_id,
            title: item.movie_title,
            name: item.movie_title,
            poster_path: item.movie_poster_path,
            backdrop_path: null,
            media_type: item.media_type || "movie",
            vote_average: 0,
            overview: "",
            genre_ids: [],
            release_date: "",
          } as TMDBMovie);
        });
        setWatchlist(items);

        // Load activity feed
        const activityQ = query(
          collection(db, "activity_feed"),
          where("user_id", "==", data.ownerId),
          orderBy("created_at", "desc"),
          limit(10)
        );
        const activitySnap = await getDocs(activityQ);
        const feedItems: ActivityFeedItem[] = [];
        activitySnap.forEach((d) => {
          feedItems.push({ id: d.id, ...d.data() } as ActivityFeedItem);
        });
        setActivity(feedItems);
      } catch {
        // Profile might not exist or isn't public
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="glass-panel rounded-3xl p-10 max-w-md w-full text-center">
          <p className="text-white text-lg font-semibold mb-4">Profile not found</p>
          <button
            onClick={() => router.back()}
            className="btn-primary min-h-[44px] px-6 py-3 focus-ring"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const AVATAR_COLORS = [
    "from-red-500 to-orange-600",
    "from-blue-500 to-cyan-600",
    "from-green-500 to-emerald-600",
    "from-purple-500 to-pink-600",
  ];
  const colorIndex = profile.displayName.charCodeAt(0) % AVATAR_COLORS.length;

  const isOwnProfile = user?.uid === profile.ownerId;

  const handleToggleFollow = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Sign in to follow other movie fans.",
      });
      router.push("/auth");
      return;
    }
    try {
      await toggleFollow();
      toast({
        title: isFollowing ? "Unfollowed" : "Following",
        description: isFollowing
          ? `You unfollowed ${profile.displayName}`
          : `You are now following ${profile.displayName}`,
      });
    } catch {
      toast({
        title: "Action failed",
        description: "Could not update follow status. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-white/10 focus-ring min-w-[44px] min-h-[44px]" aria-label="Go back">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-white font-bold truncate">{profile.displayName}</h1>
        </div>
      </div>

      <div className="pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        {/* Profile header */}
        <Reveal className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-6">
            {profile.avatarUrl ? (
              <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-white/10 glow-ring shrink-0">
                <Image src={profile.avatarUrl} alt={profile.displayName} width={96} height={96} className="object-cover w-full h-full" />
              </div>
            ) : (
              <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${AVATAR_COLORS[colorIndex]} flex items-center justify-center glow-ring shrink-0`}>
                <span className="text-3xl font-black text-white">{profile.displayName.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div>
              <h1 className="display-title text-2xl font-bold text-white">{profile.displayName}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="chip">
                  {profile.type === "kids" ? "Kids Profile" : "Member"}
                  {profile.isPrimary && " · Primary"}
                </span>
                <span className="chip text-gray-300">
                  <Users className="w-3.5 h-3.5 mr-1" />
                  {followerCount} {followerCount === 1 ? "follower" : "followers"}
                </span>
              </div>
            </div>
          </div>

          {!isOwnProfile && (
            <div className="flex items-center gap-3 self-start sm:self-auto">
              <button
                type="button"
                onClick={handleToggleFollow}
                className={`min-h-[44px] px-6 py-2.5 rounded-xl font-semibold text-sm transition-all focus-ring inline-flex items-center gap-2 ${
                  isFollowing
                    ? "bg-white/10 hover:bg-red-500/20 hover:text-red-300 text-white border border-white/15"
                    : "btn-primary"
                }`}
              >
                {isFollowing ? (
                  <>
                    <UserCheck className="w-4 h-4" />
                    Following
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Follow
                  </>
                )}
              </button>
            </div>
          )}
        </Reveal>

        <div className="divider-glow mb-10" />

        {/* Watchlist */}
        {watchlist.length > 0 ? (
          <Reveal className="mb-12">
            <SectionHeader title="My List" eyebrow="Watchlist" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mt-2 content-auto">
              {watchlist.map((movie) => (
                <div key={movie.id} className="hover-lift-sm rounded-2xl">
                  <MovieCard movie={movie} />
                </div>
              ))}
            </div>
          </Reveal>
        ) : (
          <div className="text-center py-16">
            <div className="glass-panel rounded-3xl p-10 max-w-md mx-auto">
              <Film className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-300 text-sm">This profile&apos;s list is private or empty.</p>
            </div>
          </div>
        )}

        {/* Activity Feed */}
        {activity.length > 0 && (
          <Reveal className="mb-12">
            <SectionHeader title="Recent Activity" eyebrow="Feed" />
            <div className="space-y-3 mt-2">
              {activity.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-2xl surface hover:surface-elevated border border-white/10 hover-lift-sm transition-all">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                    {item.type === "review" && <Star className="w-4 h-4 text-yellow-400" />}
                    {item.type === "rating" && <Star className="w-4 h-4 text-yellow-400" />}
                    {item.type === "watchlist_add" && <Film className="w-4 h-4 text-red-400" />}
                    {item.type === "watched" && <Tv className="w-4 h-4 text-blue-400" />}
                    {item.type === "follow" && <Activity className="w-4 h-4 text-green-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-300">
                      {item.type === "review" && `Reviewed ${item.content_title}`}
                      {item.type === "rating" && `Rated ${item.content_title} ${item.rating}/10`}
                      {item.type === "watchlist_add" && `Added ${item.content_title} to list`}
                      {item.type === "watched" && `Watched ${item.content_title}`}
                      {item.type === "follow" && `Started following ${item.target_user_name}`}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        )}
      </div>
    </div>
  );
}
