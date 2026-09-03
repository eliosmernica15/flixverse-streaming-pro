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
  "vidsrc.me",
  "vidsrc.pm",
  "vidsrc.to",
  "vidsrc.in",
  "vidsrc.su",
  "vidlink.pro",
  "videasy.net",
  "player.videasy.net",
  "vidfast.pro",
  "2embed.cc",
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
  // VidSrc exposes a `?sub=<iso639-1>` URL parameter that auto-loads the
  // chosen subtitle track in its in-player menu. There are several mirror
  // domains; `vidsrc.sbs` is documented as the canonical one but it
  // currently 200s with a "blocked, contact the site owner" page in the
  // body, so we use the live mirrors instead. `vidsrc.me` is the most
  // reliable based on body-size + content, so it is the primary.
  const allowedLangs = new Set(["en", "sq"]);
  const playerLang = lang && allowedLangs.has(lang) ? lang : "en";

  const vidsrcBase = isTv
    ? `https://vidsrc.me/embed/tv/${movieId}/${season}/${episode}`
    : `https://vidsrc.me/embed/movie/${movieId}`;
  const vidsrcUrl = `${vidsrcBase}?autoplay=true&sub=${playerLang}`;

  const vidsrcBasePm = isTv
    ? `https://vidsrc.pm/embed/tv/${movieId}/${season}/${episode}`
    : `https://vidsrc.pm/embed/movie/${movieId}`;
  const vidsrcUrlPm = `${vidsrcBasePm}?autoplay=true&sub=${playerLang}`;

  const vidsrcBaseTo = isTv
    ? `https://vidsrc.to/embed/tv/${movieId}/${season}/${episode}`
    : `https://vidsrc.to/embed/movie/${movieId}`;
  const vidsrcUrlTo = `${vidsrcBaseTo}?autoplay=true&sub=${playerLang}`;

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
      // Vidsrc.me — live mirror. The newer vidsrc.sbs domain returns 200
      // but with a "blocked, contact the site owner" body, so it cannot
      // be used as a default. vidsrc.me + the .pm / .to mirrors still
      // serve real embeds with the `?sub=<iso639-1>` parameter that
      // auto-loads the requested subtitle track in the in-player menu.
      id: "vidsrc",
      name: "VidSrc",
      icon: "📺",
      quality: "HD",
      reliability: "high",
      providerUrl: vidsrcUrl,
    },
    {
      // vidsrc.pm — same API, different mirror, used as second-attempt
      // fallback when the primary vidsrc.me is down.
      id: "vidsrc-pm",
      name: "VidSrc (PM)",
      icon: "📺",
      quality: "HD",
      reliability: "medium",
      providerUrl: vidsrcUrlPm,
    },
    {
      // vidsrc.to — third mirror, third fallback.
      id: "vidsrc-to",
      name: "VidSrc (TO)",
      icon: "📺",
      quality: "HD",
      reliability: "medium",
      providerUrl: vidsrcUrlTo,
    },
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
    // The sources below are dead or block us and have been removed:
    //   - multiembed.mov (SuperEmbed) — returns 200 but body says
    //     "content is blocked, contact the site owner"
    //   - embed.su — DNS no longer resolves, domain is dead
    //   - 2embed.cc — see kept entry below; it returns 200 OK on the
    //     root path, but the embed route returns a thin page that the
    //     browser shows as a blank iframe. We keep it because users
    //     sometimes have a working alternative.
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
