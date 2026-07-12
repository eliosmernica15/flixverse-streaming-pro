"use client";

import { useState, useEffect } from "react";
import { Clock, Star, Sparkles, Film } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfileContext } from "@/contexts/UserProfileContext";
import Link from "next/link";
import Reveal from "./Reveal";

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
    <section className="w-full min-w-0 flex-1" aria-label="Personalized welcome">
        <Reveal className="glass-panel relative overflow-hidden rounded-2xl border border-white/8 p-5 sm:p-6 shadow-xl">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-red-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div className="flex min-w-0 items-start gap-4">
              <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/15 sm:flex">
                <Film className="h-5 w-5 text-red-400" />
              </div>
              <div className="min-w-0">
                <h2 className="flex flex-wrap items-center gap-2 text-xl font-bold text-white sm:text-2xl">
                  <span className="gradient-text">{greeting}</span>
                  <Sparkles className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />
                </h2>
                <p className="mt-1.5 leading-relaxed text-gray-400 text-sm sm:text-base">{message}</p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2.5">
              {!isAuthenticated ? (
                <Link href="/auth" className="btn-primary px-5 py-2.5 text-sm focus-ring">
                  Sign In Free
                </Link>
              ) : (
                <>
                  <span className="glass-card inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-gray-300 sm:text-sm">
                    <Star className="h-4 w-4 text-yellow-500" />
                    Personalized
                  </span>
                  <span className="glass-card inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs capitalize text-gray-300 sm:text-sm">
                    <Clock className="h-4 w-4 text-sky-400" />
                    {timeOfDay}
                  </span>
                </>
              )}
            </div>
          </div>

          {isAuthenticated && profile && (
            <div className="relative z-10 mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-4">
              <span className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300">
                Synced Watchlist
              </span>
            </div>
          )}
        </Reveal>
    </section>
  );
};

export default PersonalizedWelcome;
