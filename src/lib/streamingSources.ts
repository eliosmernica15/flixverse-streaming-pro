import { buildYapGridEmbedUrl, YAPGRID_LANES } from "./player/yapgrid";

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
  "vidlink.pro",
  "videasy.net",
  "player.videasy.net",
  "vidfast.pro",
  "vidsrc.me",
  "vidsrc.net",
  "2embed.cc",
  "multiembed.mov",
  "embed.su",
  "yapgrid.com",
] as const;

export function isAllowedEmbedUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return ALLOWED_EMBED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export type BuildStreamingOptions = {
  /** ISO 639-1, e.g. sq — only applied to hosts with documented params. */
  lang?: string;
  title?: string;
};

export function buildStreamingSources(
  movieId: number,
  mediaType: "movie" | "tv",
  season?: number,
  episode?: number,
  opts?: BuildStreamingOptions
): StreamingSource[] {
  const isTv = mediaType === "tv" && season && episode;
  const lang = opts?.lang?.toLowerCase();
  // YapGrid's `lang` parameter only sets the default SUBTITLE language, not the
  // audio. Their public API does not expose audio-track selection, so when
  // their upstream server happens to return a Hindi-dubbed source we can't
  // override it. We put the providers that DO honour per-language audio
  // (Videasy, VidLink, VidFast) first and fall back to YapGrid's Z/Y/X only
  // when those fail. The user can also switch from the in-player audio menu.
  const allowedLangs = new Set(["en", "sq"]);
  const playerLang = lang && allowedLangs.has(lang) ? lang : "en";

  // For non-English we ship an external subtitle URL through our own captions
  // proxy. The proxy returns a CORS-enabled .vtt (real subs when available,
  // a placeholder VTT otherwise) and we point the embed's `sub_url` at it.
  // This is the only reliable way to guarantee Albanian subs show on top of
  // English audio, because none of the public embed providers expose audio
  // language selection in their query API.
  const absoluteBase = (() => {
    if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
    return process.env.NEXT_PUBLIC_SITE_URL || "https://flixverse.app";
  })();
  const subUrl =
    playerLang === "sq"
      ? `${absoluteBase}/api/captions?tmdbId=${movieId}&type=${mediaType}${
          isTv ? `&season=${season}&episode=${episode}` : ""
        }&lang=sq&format=vtt`
      : null;

  const vidfastBase = isTv
    ? `https://vidfast.pro/tv/${movieId}/${season}/${episode}?autoPlay=true`
    : `https://vidfast.pro/movie/${movieId}?autoPlay=true`;
  const vidfastUrl = playerLang === "sq" ? `${vidfastBase}&sub=sq` : vidfastBase;

  // YapGrid server tokens. We pin G (sg_g4) first because it's YapGrid's own
  // default in their test player, runs on the Vidrock Edge direct-MP4 CDN,
  // and is the most likely source to have clean English audio on popular titles.
  // The old `?server=x|y|z` short labels are display-only — the real
  // server tokens are sg_g4 / sx_a1 / sy_b2 / sz_c3. Passing the short
  // label falls back to YapGrid's "auto" mode, which on the upstream we
  // hit was returning a Hindi-dubbed mirror.
  const yapgridSources: (Omit<StreamingSource, "url"> & { providerUrl: string })[] =
    YAPGRID_LANES.map((lane) => {
      const url = buildYapGridEmbedUrl({
        movieId,
        mediaType,
        season,
        episode,
        server: lane.token,
        lang: playerLang,
        title: opts?.title,
        subUrl: subUrl ?? undefined,
        subLang: subUrl ? "sq" : undefined,
        subLabel: subUrl ? "Albanian" : undefined,
      });
      return {
        id: `yapgrid-${lane.id}`,
        name: `YapGrid ${lane.label}`,
        icon: "🇦🇱",
        quality: "FHD" as const,
        reliability: lane.id === "g" ? ("high" as const) : ("medium" as const),
        providerUrl: url,
      };
    });

  const primary: (Omit<StreamingSource, "url"> & { providerUrl: string })[] = [
    {
      id: "videasy",
      name: "Videasy (4K)",
      icon: "🎬",
      quality: "4K",
      reliability: "high",
      providerUrl: isTv
        ? `https://player.videasy.net/tv/${movieId}/${season}/${episode}?autoplay=true`
        : `https://player.videasy.net/movie/${movieId}?autoplay=true`,
    },
    {
      id: "vidlink",
      name: "VidLink",
      icon: "🔗",
      quality: "FHD",
      reliability: "high",
      providerUrl: isTv
        ? `https://vidlink.pro/tv/${movieId}/${season}/${episode}?autoplay=true`
        : `https://vidlink.pro/movie/${movieId}?autoplay=true`,
    },
    {
      id: "vidfast",
      name: "VidFast",
      icon: "⚡",
      quality: "FHD",
      reliability: "high",
      providerUrl: vidfastUrl,
    },
    {
      id: "vidsrc",
      name: "VidSrc",
      icon: "📺",
      quality: "HD",
      reliability: "high",
      providerUrl: isTv
        ? `https://vidsrc.me/embed/tv?tmdb=${movieId}&season=${season}&episode=${episode}`
        : `https://vidsrc.me/embed/movie?tmdb=${movieId}`,
    },
    {
      id: "2embed",
      name: "2Embed",
      icon: "🎞️",
      quality: "HD",
      reliability: "medium",
      providerUrl: isTv
        ? `https://www.2embed.cc/embedtv/${movieId}&s=${season}&e=${episode}`
        : `https://www.2embed.cc/embed/${movieId}`,
    },
    {
      id: "superembed",
      name: "SuperEmbed",
      icon: "📽️",
      quality: "FHD",
      reliability: "medium",
      providerUrl: isTv
        ? `https://multiembed.mov/?video_id=${movieId}&tmdb=1&s=${season}&e=${episode}`
        : `https://multiembed.mov/?video_id=${movieId}&tmdb=1`,
    },
    {
      id: "embed-su",
      name: "Embed SU",
      icon: "🎥",
      quality: "HD",
      reliability: "medium",
      providerUrl: isTv
        ? `https://embed.su/embed/tv/${movieId}/${season}/${episode}`
        : `https://embed.su/embed/movie/${movieId}`,
    },
  ];

  // YapGrid is intentionally LAST — its audio is upstream-controlled and
  // we can't force it to English/Albanian, so it should only be tried after
  // every better-behaved provider has failed.
  const ordered = [...primary, ...yapgridSources];

  return ordered.map((s) => ({
    ...s,
    url: s.providerUrl,
  }));
}

const QUALITY_RANK: Record<StreamingSource["quality"], number> = {
  HD: 1,
  FHD: 2,
  "4K": 3,
};

/** Pick the best server index matching a quality label (Auto returns current or best FHD). */
export function pickServerByQuality(
  sources: StreamingSource[],
  label: string,
  currentIndex = 0
): number {
  if (label === "Auto") {
    const fhd = sources.findIndex((s) => s.quality === "FHD");
    return fhd >= 0 ? fhd : currentIndex;
  }

  const targetQuality =
    label === "4K" ? "4K" :
    label === "1080p" ? "FHD" :
    "HD";

  const match = sources.findIndex((s) => s.quality === targetQuality);
  if (match >= 0) return match;

  const rank = targetQuality === "4K" ? 3 : targetQuality === "FHD" ? 2 : 1;
  let bestIdx = 0;
  let bestRank = -1;
  sources.forEach((s, i) => {
    const r = QUALITY_RANK[s.quality];
    if (r <= rank && r > bestRank) {
      bestRank = r;
      bestIdx = i;
    }
  });
  return bestIdx;
}
