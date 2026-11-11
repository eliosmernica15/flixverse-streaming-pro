import { buildYapGridEmbedUrl, YAPGRID_LANES } from "./player/yapgrid";
import ALLOWED_EMBED_HOSTS from "./embedHosts.json";

export interface StreamingSource {
  id: string;
  name: string;
  icon: string;
  quality: "HD" | "FHD" | "4K";
  reliability: "high" | "medium";
  /**
   * Iframe `src` — the raw provider URL (direct cross-origin iframe).
   * (`providerUrl` duplicates it for postMessage origin detection.)
   */
  url: string;
  /** Original provider URL (for postMessage origin detection). */
  providerUrl: string;
}

/** Allowed embed hostnames; security-headers.mjs builds frame-src from this list. */
export { ALLOWED_EMBED_HOSTS };

export function isAllowedEmbedUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return ALLOWED_EMBED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** Unwrap legacy proxy URLs so old links can still be resolved directly. */
export function unproxyEmbedUrl(iframeSrc: string): string {
  try {
    const url = new URL(iframeSrc, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    if (url.pathname === "/api/embed") {
      const embedded = url.searchParams.get("src");
      if (embedded) return decodeURIComponent(embedded);
    }
  } catch {
    // ignore
  }
  return iframeSrc;
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
  // VidSrc's canonical domain is `vidsrc.to`. The old `vidsrcme.ru` is
  // NXDOMAIN — the name no longer exists, so every URL pointing at it
  // failed to load for all users. It accepts both IMDB ids (`tt...`) and
  // TMDB ids (numeric), and exposes `?ds_lang=<iso639-1>` (or a comma-separated
  // priority list) to pre-select subtitle tracks, plus `?sub_url=...` for
  // custom .vtt tracks. We pass `?autoplay=true&ds_lang=<en|sq>` so the
  // in-player CC menu opens with the user's preferred language highlighted.
  const allowedLangs = new Set(["en", "sq"]);
  const playerLang = lang && allowedLangs.has(lang) ? lang : "en";

  const vidsrcBase = isTv
    ? `https://vidsrc.to/embed/tv/${movieId}/${season}/${episode}`
    : `https://vidsrc.to/embed/movie/${movieId}`;
  const vidsrcUrl = `${vidsrcBase}?autoplay=true&ds_lang=${playerLang}`;

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
      // VidSrc — canonical domain `vidsrc.to`. Accepts both IMDB ids
      // (`tt...`) and TMDB ids (numeric). Uses the `?ds_lang=<iso>` parameter
      // (or comma-separated priority list) to pre-select subtitle tracks,
      // plus `?sub_url=...` for custom .vtt tracks. The previous `vidsrcme.ru`
      // domain is NXDOMAIN (confirmed 2026-11-11).
      id: "vidsrc",
      name: "VidSrc",
      icon: "📺",
      quality: "HD",
      reliability: "high",
      providerUrl: vidsrcUrl,
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
      // VidFast works on the actual website per the user, even though
      // our test environment can't reach the embed endpoint. Keep it.
      id: "vidfast",
      name: "VidFast",
      icon: "⚡",
      quality: "FHD",
      reliability: "high",
      providerUrl: vidfastUrl,
    },
    {
      // Videasy — canonical domain is `player.videasy.to`. As of
      // 2026-11-11 their TLS is broken (cert verify fails) and plain HTTP
      // returns 503, so demoted out of the top picks until it recovers.
      id: "videasy",
      name: "Videasy",
      icon: "🎬",
      quality: "FHD",
      reliability: "medium",
      providerUrl: isTv
        ? `https://player.videasy.to/tv/${movieId}/${season}/${episode}?autoplay=true`
        : `https://player.videasy.to/movie/${movieId}?autoplay=true`,
    },
    // NOTE: YapGrid lanes are NOT listed here — `ordered` below appends
    // all four yapgridSources (g/x/y/z) after the primary providers.
    // Listing yapgrid-g here too produced a duplicate "YapGrid G" entry
    // in the server selector.
    // Dead / blocked / 404 sources have been removed:
    //   - vidsrcme.ru — NXDOMAIN (domain defunct as of 2026-11-11); replaced
    //     by the `vidsrc.to`-based "vidsrc" entry above
    //   - vidsrc.sbs — returns 200 but body says "blocked"
    //   - vidsrc.pm — doesn't work in our test env (user flagged)
    //   - vidsrc.in / vidsrc.su / vidsrc.me / multiembed.mov — blocked
    //     or 404 in our tests
    //   - embed.su — DNS dead
    //   - player.videasy.net — superseded by player.videasy.to per docs
    //   - 2embed.cc — returns 200 but the body is a thin page that shows
    //     up as a blank iframe; left out entirely
  ];

  // YapGrid is intentionally LAST — its audio is upstream-controlled and
  // we can't force it to English/Albanian, so it should only be tried after
  // every better-behaved provider has failed.
  const ordered = [...primary, ...yapgridSources];

  return ordered.map((s) => ({
    ...s,
    // Keep provider content cross-origin. The server-side HTML proxy is
    // intentionally not used: provider scripts depend on their own origin.
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
