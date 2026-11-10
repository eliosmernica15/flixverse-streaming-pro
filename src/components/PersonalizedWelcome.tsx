"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Clock, Star, Sparkles, Film } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfileContext } from "@/contexts/UserProfileContext";
import Reveal from "./Reveal";

const PersonalizedWelcome = () => {
  const { user, isAuthenticated } = useAuth();
  const { profile } = useUserProfileContext();
  const t = useTranslations("welcome");
  const tc = useTranslations("common");
  const [greeting, setGreeting] = useState(t("goodEvening"));
  const [timeOfDay, setTimeOfDay] = useState("");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting(t("goodMorning"));
      setTimeOfDay("morning");
    } else if (hour < 18) {
      setGreeting(t("goodAfternoon"));
      setTimeOfDay("afternoon");
    } else {
      setGreeting(t("goodEvening"));
      setTimeOfDay("evening");
    }
  }, [t]);

  const displayName = profile?.display_name || user?.email?.split("@")[0] || t("movieLover");
  const message = isAuthenticated
    ? t("welcomeBack", { name: displayName })
    : t("guestMessage");

  return (
    <section className="w-full min-w-0 flex-1" aria-label="Personalized welcome">
        <Reveal className="glass-soft relative overflow-hidden rounded-2xl border border-white/8 p-5 sm:p-6 shadow-xl">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-red-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div className="flex min-w-0 items-start gap-4">
              <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/15 sm:flex">
                <Film className="h-5 w-5 text-red-400" />
              </div>
              <div className="min-w-0">
                <h2 className="flex flex-wrap items-center gap-2 text-xl font-bold text-white sm:text-2xl">
                  <span className="text-white">{greeting}</span>
                  <Sparkles className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />
                </h2>
                <p className="mt-1 leading-relaxed text-gray-400 text-sm sm:text-base">{message}</p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {!isAuthenticated ? (
                <Link href="/auth" className="inline-flex items-center justify-center rounded-md bg-red-600 hover:bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-500/25 transition-colors focus-ring">
                  {tc("signInFree")}
                </Link>
              ) : (
                <>
                  <Link href="/movies" className="inline-flex items-center justify-center rounded-md bg-white text-black hover:bg-white/85 px-4 py-2 text-sm font-bold transition-colors focus-ring">
                    {tc("continueWatching")}
                  </Link>
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1.5 text-xs text-gray-300 ring-1 ring-white/10 sm:text-sm">
                    <Star className="h-3.5 w-3.5 text-yellow-500" />
                    {t("personalized")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1.5 text-xs capitalize text-gray-300 ring-1 ring-white/10 sm:text-sm">
                    <Clock className="h-3.5 w-3.5 text-sky-400" />
                    {timeOfDay}
                  </span>
                </>
              )}
            </div>
          </div>

          {isAuthenticated && profile && (
            <div className="relative z-10 mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-4">
              <span className="rounded-md border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-300">
                {t("syncedWatchlist")}
              </span>
            </div>
          )}
        </Reveal>
    </section>
  );
};

export default PersonalizedWelcome;
