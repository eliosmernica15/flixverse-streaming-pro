export interface StreamingSource {
  id: string;
  name: string;
  icon: string;
  quality: "HD" | "FHD" | "4K";
  reliability: "high" | "medium";
  url: string;
}

export function buildStreamingSources(
  movieId: number,
  mediaType: "movie" | "tv",
  season?: number,
  episode?: number
): StreamingSource[] {
  const isTv = mediaType === "tv" && season && episode;

  return [
    {
      id: "vidsrc-cc",
      name: "VidSrc CC",
      icon: "📺",
      quality: "FHD",
      reliability: "high",
      url: isTv
        ? `https://vidsrc.cc/v2/embed/tv/${movieId}/${season}/${episode}`
        : `https://vidsrc.cc/v2/embed/movie/${movieId}`,
    },
    {
      id: "vidsrc-pro",
      name: "VidSrc Pro",
      icon: "🎬",
      quality: "FHD",
      reliability: "high",
      url: isTv
        ? `https://vidsrc.xyz/embed/tv?tmdb=${movieId}&season=${season}&episode=${episode}`
        : `https://vidsrc.xyz/embed/movie?tmdb=${movieId}`,
    },
    {
      id: "vidlink",
      name: "VidLink",
      icon: "🔗",
      quality: "HD",
      reliability: "medium",
      url: isTv
        ? `https://vidlink.pro/tv/${movieId}/${season}/${episode}`
        : `https://vidlink.pro/movie/${movieId}`,
    },
    {
      id: "vidsrc-icu",
      name: "VidSrc ICU",
      icon: "🎥",
      quality: "HD",
      reliability: "medium",
      url: isTv
        ? `https://vidsrc.icu/embed/tv/${movieId}/${season}/${episode}`
        : `https://vidsrc.icu/embed/movie/${movieId}`,
    },
    {
      id: "embed-su",
      name: "Embed SU",
      icon: "🎞️",
      quality: "HD",
      reliability: "medium",
      url: isTv
        ? `https://embed.su/embed/tv/${movieId}/${season}/${episode}`
        : `https://embed.su/embed/movie/${movieId}`,
    },
    {
      id: "superembed",
      name: "SuperEmbed",
      icon: "📽️",
      quality: "FHD",
      reliability: "high",
      url: isTv
        ? `https://multiembed.mov/?video_id=${movieId}&tmdb=1&s=${season}&e=${episode}`
        : `https://multiembed.mov/?video_id=${movieId}&tmdb=1`,
    },
    {
      id: "autoembed",
      name: "AutoEmbed",
      icon: "⚡",
      quality: "HD",
      reliability: "medium",
      url: isTv
        ? `https://player.autoembed.cc/embed/tv/${movieId}/${season}/${episode}`
        : `https://player.autoembed.cc/embed/movie/${movieId}`,
    },
    {
      id: "smashystream",
      name: "SmashyStream",
      icon: "💥",
      quality: "FHD",
      reliability: "high",
      url: isTv
        ? `https://player.smashy.stream/tv/${movieId}?s=${season}&e=${episode}`
        : `https://player.smashy.stream/movie/${movieId}`,
    },
  ];
}
