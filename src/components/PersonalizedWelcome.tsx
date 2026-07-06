"use client";

import { useState, useEffect } from "react";
import { Clock, Star, Sparkles, Film } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfileContext } from "@/contexts/UserProfileContext";
import Link from "next/link";

const PersonalizedWelcome = () => {
  const { user, isAuthenticated } = useAuth();
  const { profile } = useUserProfileContext();
  const [greeting, setGreeting] = useState("Welcome");
  const [timeOfDay, setTimeOfDay] = useState("");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting("Good Morning");
      setTimeOfDay("morning");
    } else if (hour < 18) {
      setGreeting("Good Afternoon");
      setTimeOfDay("afternoon");
    } else {
      setGreeting("Good Evening");
      setTimeOfDay("evening");
    }
  }, []);

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Movie Lover";
  const message = isAuthenticated
    ? `Welcome back, ${displayName}. Pick up where you left off or discover something new.`
    : "Sign in to unlock personalized recommendations, watchlists, and continue watching.";

  return (
    <section className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6" aria-label="Personalized welcome">
      <div className="max-w-[1800px] mx-auto">
        <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-red-950/20 p-5 sm:p-6 shadow-xl">
          <div className="absolute top-0 right-0 w-40 h-40 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="flex items-start gap-4 min-w-0">
              <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/20 items-center justify-center shrink-0">
                <Film className="w-5 h-5 text-red-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 flex-wrap">
                  <span>{greeting}</span>
                  <Sparkles className="w-5 h-5 text-amber-400 shrink-0" aria-hidden />
                </h2>
                <p className="text-gray-400 text-sm sm:text-base mt-1.5 leading-relaxed">{message}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {!isAuthenticated ? (
                <Link href="/auth" className="btn-primary px-5 py-2.5 text-sm">
                  Sign In Free
                </Link>
              ) : (
                <>
                  <span className="inline-flex items-center gap-2 glass-card px-3 py-2 rounded-xl text-xs sm:text-sm text-gray-300">
                    <Star className="w-4 h-4 text-yellow-500" />
                    Personalized
                  </span>
                  <span className="inline-flex items-center gap-2 glass-card px-3 py-2 rounded-xl text-xs sm:text-sm text-gray-300 capitalize">
                    <Clock className="w-4 h-4 text-sky-400" />
                    {timeOfDay}
                  </span>
                </>
              )}
            </div>
          </div>

          {isAuthenticated && profile && (
            <div className="relative z-10 mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-lg text-xs font-medium bg-sky-500/10 text-sky-300 border border-sky-500/20">
                Synced Watchlist
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default PersonalizedWelcome;
