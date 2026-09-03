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
  "vidsrc.sbs",
  "vidsrc.me",
  "videasy.net",
  "player.videasy.net",
  "vidfast.pro",
  "vidlink.pro",
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
  // Vidsrc (`vidsrc.sbs`) exposes a `?sub=<iso639-1>` URL parameter that
  // auto-loads the chosen subtitle track in its player. It is the only
  // provider in this list that natively supports a "load Albanian subs by
  // default" feature without requiring us to ship our own .vtt, so it
  // gets special handling and is moved up the priority list.
  const allowedLangs = new Set(["en", "sq"]);
  const playerLang = lang && allowedLangs.has(lang) ? lang : "en";

  const vidsrcBase = isTv
    ? `https://vidsrc.sbs/embed/tv/${movieId}/${season}/${episode}`
    : `https://vidsrc.sbs/embed/movie/${movieId}`;
  const vidsrcUrl = `${vidsrcBase}?autoplay=true&sub=${playerLang}`;

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
      // Vidsrc exposes a `?sub=<iso639-1>` parameter that auto-loads the
      // requested subtitle track in its in-player menu. We promote it to
      // the top of the list so the user lands on the provider that respects
      // their preferred-language preference out of the box.
      id: "vidsrc",
      name: "VidSrc",
      icon: "📺",
      quality: "HD",
      reliability: "high",
      providerUrl: vidsrcUrl,
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
