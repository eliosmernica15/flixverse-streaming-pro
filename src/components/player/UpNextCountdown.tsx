"use client";

import { useState, useEffect, useCallback } from "react";
import { Play } from "lucide-react";
import Image from "next/image";
import { getImageUrl } from "@/utils/tmdbApi";

interface UpNextCountdownProps {
  nextEpisode: {
    season: number;
    episode: number;
    name?: string;
    overview?: string;
    still_path?: string;
  };
  posterPath?: string | null;
  countdownSeconds?: number;
  onPlay: () => void;
  onSkip: () => void;
}

export function UpNextCountdown({
  nextEpisode,
  posterPath,
  countdownSeconds = 15,
  onPlay,
  onSkip,
}: UpNextCountdownProps) {
  const [remaining, setRemaining] = useState(countdownSeconds);
  const [isCancelled, setIsCancelled] = useState(false);

  useEffect(() => {
    if (isCancelled) return;

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onPlay();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isCancelled, onPlay]);

  const handleCancel = useCallback(() => {
    setIsCancelled(true);
    onSkip();
  }, [onSkip]);

  if (isCancelled) return null;

  const progress = ((countdownSeconds - remaining) / countdownSeconds) * 100;

  return (
    <div className="player-upnext-overlay" role="dialog" aria-label="Up next episode">
      <div className="relative w-full max-w-md mx-4">
        {/* Progress ring */}
        <div className="absolute -top-4 right-0">
          <div className="relative w-12 h-12">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="3"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="#ef4444"
                strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - progress / 100)}`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
              {remaining}
            </span>
          </div>
        </div>

        <div className="bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          {/* Thumbnail */}
          <div className="relative h-40 overflow-hidden">
            {nextEpisode.still_path ? (
              <Image
                src={getImageUrl(nextEpisode.still_path, "medium")}
                alt={nextEpisode.name || `S${nextEpisode.season} E${nextEpisode.episode}`}
                fill
                className="object-cover"
                sizes="400px"
              />
            ) : posterPath ? (
              <Image
                src={getImageUrl(posterPath, "medium")}
                alt={nextEpisode.name || "Next episode"}
                fill
                className="object-cover object-top"
                sizes="400px"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-red-600/30 to-zinc-800" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
          </div>

          <div className="p-5">
            <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">Up Next</p>
            <h3 className="text-lg font-bold text-white mb-1">
              {nextEpisode.name || `Episode ${nextEpisode.episode}`}
            </h3>
            <p className="text-xs text-gray-400 mb-2">
              Season {nextEpisode.season} · Episode {nextEpisode.episode}
            </p>
            {nextEpisode.overview && (
              <p className="text-xs text-gray-500 line-clamp-2 mb-4">{nextEpisode.overview}</p>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={onPlay}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-gray-100 transition-colors"
              >
                <Play className="w-4 h-4 fill-current" />
                Play Now
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm font-medium hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
