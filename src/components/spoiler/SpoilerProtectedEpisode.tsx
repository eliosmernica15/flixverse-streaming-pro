"use client";

import { useState } from "react";
import { EyeOff, Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import { useSpoilerProgress } from "@/hooks/player/useSpoilerProgress";
import { isSpoilerGuardEnabled } from "@/lib/player/spoilerGuard";
import { useSubscription } from "@/hooks/useSubscription";

interface SpoilerProtectedEpisodeProps {
  contentId: number;
  season: number;
  episode: number;
  children: React.ReactNode;
  className?: string;
}

export function SpoilerProtectedEpisode({
  contentId,
  season,
  episode,
  children,
  className = "",
}: SpoilerProtectedEpisodeProps) {
  const { isSpoiler, loading } = useSpoilerProgress(contentId, season, episode);
  const [isRevealed, setIsRevealed] = useState(false);
  const guardEnabled = isSpoilerGuardEnabled();
  const { hasStandard } = useSubscription();

  if (!guardEnabled || loading || !isSpoiler || isRevealed) {
    return <>{children}</>;
  }

  if (!hasStandard) {
    return (
      <div className={`relative overflow-hidden rounded-xl border border-white/5 ${className}`}>
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md">
          <Lock className="mb-2 h-5 w-5 text-red-400" />
          <p className="mb-3 px-2 text-center text-[10px] font-bold uppercase tracking-widest text-gray-300">
            Spoiler Guard — Premium
          </p>
          <Link
            href="/plans"
            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-[10px] font-semibold text-white"
          >
            <Sparkles className="h-3 w-3" />
            View Plans
          </Link>
        </div>
        <div className="pointer-events-none opacity-30 blur-[4px] filter">{children}</div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl border border-white/5 ${className}`}>
      <div
        className="absolute inset-0 z-10 flex cursor-pointer flex-col items-center justify-center bg-black/70 backdrop-blur-md transition-all hover:bg-black/50"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsRevealed(true);
        }}
        role="button"
        aria-label={`Reveal spoiler for Episode ${episode}`}
      >
        <EyeOff className="mb-1 h-5 w-5 text-gray-400" />
        <span className="px-1 text-center text-[10px] font-bold uppercase tracking-widest text-gray-300">
          Spoiler
          <br />
          Reveal
        </span>
      </div>
      <div className="pointer-events-none opacity-30 blur-[4px] filter">{children}</div>
    </div>
  );
}
