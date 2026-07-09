"use client";

import { useState } from "react";
import { EyeOff } from "lucide-react";
import { useSpoilerProgress } from "@/hooks/player/useSpoilerProgress";
import { isSpoilerGuardEnabled } from "@/lib/player/spoilerGuard";

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

  if (!guardEnabled || loading || !isSpoiler || isRevealed) {
    return <>{children}</>;
  }
  return (
    <div className={`relative overflow-hidden rounded-xl border border-white/5 ${className}`}>
      <div 
        className="absolute inset-0 z-10 backdrop-blur-md bg-black/70 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-black/50"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsRevealed(true);
        }}
        role="button"
        aria-label={`Reveal spoiler for Episode ${episode}`}
      >
        <EyeOff className="w-5 h-5 text-gray-400 mb-1" />
        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest text-center px-1">
          Spoiler<br/>Reveal
        </span>
      </div>
      <div className="pointer-events-none opacity-30 filter blur-[4px]">
        {children}
      </div>
    </div>
  );
}
