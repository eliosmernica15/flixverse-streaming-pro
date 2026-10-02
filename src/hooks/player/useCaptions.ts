import { useState, useEffect, useCallback } from "react";
import type { CaptionCue } from "@/lib/player/captionParser";
import { getActiveCue } from "@/lib/player/captionParser";

interface UseCaptionsOptions {
  tmdbId: number;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
  duration: number;
  enabled: boolean;
  lang?: string;
}

export function useCaptions({
  tmdbId,
  mediaType,
  season,
  episode,
  duration,
  enabled,
  lang = "en",
}: UseCaptionsOptions) {
  const [cues, setCues] = useState<CaptionCue[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"external" | "fallback" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !tmdbId) {
      setCues([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      tmdbId: String(tmdbId),
      type: mediaType,
      duration: String(duration),
      lang,
    });
    if (season) params.set("season", String(season));
    if (episode) params.set("episode", String(episode));

    fetch(`/api/captions?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setCues(data.cues || []);
        setSource(data.source || null);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load subtitles");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tmdbId, mediaType, season, episode, duration, enabled, lang]);

  const getCueAt = useCallback((time: number) => getActiveCue(cues, time), [cues]);

  return { cues, loading, source, error, getCueAt };
}
