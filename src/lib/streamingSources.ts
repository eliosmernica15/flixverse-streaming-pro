export interface StreamingSource {
  id: string;
  name: string;
  icon: string;
  quality: "HD" | "FHD" | "4K";
  reliability: "high" | "medium";
  url: string;
  /** Original provider URL (for postMessage origin detection). */
  providerUrl: string;
}

/** Allowed embed hostnames — must match security-headers.mjs frame-src. */
export const ALLOWED_EMBED_HOSTS = [
  "vidsrc.cc",
  "vidsrc.xyz",
  "vidsrc.icu",
  "vidlink.pro",
  "embed.su",
  "multiembed.mov",
  "player.autoembed.cc",
  "player.smashy.stream",
] as const;

export function isAllowedEmbedUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return ALLOWED_EMBED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** Route third-party embeds through our guard proxy. */
export function wrapEmbedUrl(providerUrl: string): string {
  if (typeof window === "undefined") {
    return providerUrl;
  }
  return `/api/embed?src=${encodeURIComponent(providerUrl)}`;
}

export function buildStreamingSources(
  movieId: number,
  mediaType: "movie" | "tv",
  season?: number,
  episode?: number
): StreamingSource[] {
  const isTv = mediaType === "tv" && season && episode;

  const raw: (Omit<StreamingSource, "url"> & { providerUrl: string })[] = [
    {
      id: "vidsrc-cc",
      name: "VidSrc CC",
      icon: "📺",
      quality: "FHD",
      reliability: "high",
      providerUrl: isTv
        ? `https://vidsrc.cc/v2/embed/tv/${movieId}/${season}/${episode}?autoPlay=true`
        : `https://vidsrc.cc/v2/embed/movie/${movieId}?autoPlay=true`,
    },
    {
      id: "vidsrc-pro",
      name: "VidSrc Pro",
      icon: "🎬",
      quality: "FHD",
      reliability: "high",
      providerUrl: isTv
        ? `https://vidsrc.xyz/embed/tv?tmdb=${movieId}&season=${season}&episode=${episode}`
        : `https://vidsrc.xyz/embed/movie?tmdb=${movieId}`,
    },
    {
      id: "vidlink",
      name: "VidLink",
      icon: "🔗",
      quality: "HD",
      reliability: "medium",
      providerUrl: isTv
        ? `https://vidlink.pro/tv/${movieId}/${season}/${episode}`
        : `https://vidlink.pro/movie/${movieId}`,
    },
    {
      id: "vidsrc-icu",
      name: "VidSrc ICU",
      icon: "🎥",
      quality: "HD",
      reliability: "medium",
      providerUrl: isTv
        ? `https://vidsrc.icu/embed/tv/${movieId}/${season}/${episode}`
        : `https://vidsrc.icu/embed/movie/${movieId}`,
    },
    {
      id: "embed-su",
      name: "Embed SU",
      icon: "🎞️",
      quality: "HD",
      reliability: "medium",
      providerUrl: isTv
        ? `https://embed.su/embed/tv/${movieId}/${season}/${episode}`
        : `https://embed.su/embed/movie/${movieId}`,
    },
    {
      id: "superembed",
      name: "SuperEmbed",
      icon: "📽️",
      quality: "FHD",
      reliability: "high",
      providerUrl: isTv
        ? `https://multiembed.mov/?video_id=${movieId}&tmdb=1&s=${season}&e=${episode}`
        : `https://multiembed.mov/?video_id=${movieId}&tmdb=1`,
    },
    {
      id: "autoembed",
      name: "AutoEmbed",
      icon: "⚡",
      quality: "HD",
      reliability: "medium",
      providerUrl: isTv
        ? `https://player.autoembed.cc/embed/tv/${movieId}/${season}/${episode}`
        : `https://player.autoembed.cc/embed/movie/${movieId}`,
    },
    {
      id: "smashystream",
      name: "SmashyStream",
      icon: "💥",
      quality: "FHD",
      reliability: "high",
      providerUrl: isTv
        ? `https://player.smashy.stream/tv/${movieId}?s=${season}&e=${episode}`
        : `https://player.smashy.stream/movie/${movieId}`,
    },
  ];

  return raw.map((s) => ({
    ...s,
    url: wrapEmbedUrl(s.providerUrl),
  }));
}
