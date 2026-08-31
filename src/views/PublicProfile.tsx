"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Film, Tv, Star, Activity, UserPlus, UserCheck, Users } from "lucide-react";
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
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 px-4">
        <div className="glass-soft rounded-2xl p-10 max-w-md w-full text-center">
          <p className="text-white text-lg font-semibold mb-4">Profile not found</p>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-red-600 hover:bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors focus-ring"
          >
            Go home
          </a>
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
      <div className="relative pt-24 pb-10 px-4 sm:px-6 lg:px-10 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(99, 102, 241, 0.18) 0%, transparent 60%)",
          }}
        />
        <div className="max-w-[1800px] mx-auto">
          <Reveal className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="flex items-center gap-5">
              {profile.avatarUrl ? (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden ring-2 ring-white/15 shadow-2xl shadow-black/50 shrink-0">
                  <Image src={profile.avatarUrl} alt={profile.displayName} width={96} height={96} className="object-cover w-full h-full" />
                </div>
              ) : (
                <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-gradient-to-br ${AVATAR_COLORS[colorIndex]} flex items-center justify-center shadow-2xl shadow-black/50 ring-2 ring-white/10 shrink-0`}>
                  <span className="text-3xl sm:text-4xl font-black text-white">{profile.displayName.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <div className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400 mb-1">
                  {profile.type === "kids" ? "Kids Profile" : "Member"}
                  {profile.isPrimary ? " · Primary" : ""}
                </span>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-[1.05]">
                  {profile.displayName}
                </h1>
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-gray-300">
                    <Users className="h-3 w-3" />
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
                  className={`inline-flex items-center gap-1.5 min-h-[40px] rounded-md px-5 py-2 text-sm font-bold transition-colors focus-ring ${
                    isFollowing
                      ? "border border-white/15 bg-white/5 text-white hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
                      : "bg-white text-black hover:bg-white/90"
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
        </div>
      </div>

      <div className="pb-16 px-4 sm:px-6 lg:px-10 max-w-[1800px] mx-auto">
        <div className="divider-glow mb-10" />

        {/* Watchlist */}
        {watchlist.length > 0 ? (
          <Reveal className="mb-12">
            <SectionHeader title="Public List" eyebrow={`${watchlist.length} titles`} />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 mt-3 content-auto">
              {watchlist.map((movie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          </Reveal>
        ) : (
          <div className="glass-soft rounded-2xl py-12 text-center">
            <Film className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">This profile&apos;s list is private or empty.</p>
          </div>
        )}

        {/* Activity Feed */}
        {activity.length > 0 && (
          <Reveal className="mt-4 mb-12">
            <SectionHeader title="Recent Activity" eyebrow={`${activity.length} events`} />
            <div className="space-y-2 mt-3">
              {activity.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-md border border-white/8 bg-white/3 hover:bg-white/5 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-white/5 ring-1 ring-white/10 flex items-center justify-center shrink-0">
                    {item.type === "review" && <Star className="w-3.5 h-3.5 text-yellow-400" />}
                    {item.type === "rating" && <Star className="w-3.5 h-3.5 text-yellow-400" />}
                    {item.type === "watchlist_add" && <Film className="w-3.5 h-3.5 text-red-400" />}
                    {item.type === "watched" && <Tv className="w-3.5 h-3.5 text-blue-400" />}
                    {item.type === "follow" && <Activity className="w-3.5 h-3.5 text-green-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-200">
                      {item.type === "review" && <>Reviewed <span className="font-semibold text-white">{item.content_title}</span></>}
                      {item.type === "rating" && <>Rated <span className="font-semibold text-white">{item.content_title}</span> <span className="text-yellow-400">{item.rating}/10</span></>}
                      {item.type === "watchlist_add" && <>Added <span className="font-semibold text-white">{item.content_title}</span> to list</>}
                      {item.type === "watched" && <>Watched <span className="font-semibold text-white">{item.content_title}</span></>}
                      {item.type === "follow" && <>Started following <span className="font-semibold text-white">{item.target_user_name}</span></>}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
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
