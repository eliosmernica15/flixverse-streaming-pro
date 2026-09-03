import { buildYapGridEmbedUrl, YAPGRID_LANES } from "./player/yapgrid";

export interface StreamingSource {
  id: string;
  name: string;
  icon: string;
  quality: "HD" | "FHD" | "4K";
  reliability: "high" | "medium";
  /**
   * Iframe `src` — same-origin proxy URL (`/api/embed?src=...`) for cross-origin
   * providers, raw provider URL for same-origin providers. We proxy the embed
   * through our own origin so:
   *   1. The iframe is same-origin and can be controlled by the host page.
   *   2. vidsrcme.ru's `sbx.js` sandbox-detection redirect (which fires when
   *      it detects a cross-origin / sandboxed parent) never triggers, because
   *      the page the browser actually loads is served by us.
   *   3. We can strip any provider-side sandbox-detection script or
   *      `/sandbox.php` redirect from the proxied HTML.
   */
  url: string;
  /** Original provider URL (for postMessage origin detection). */
  providerUrl: string;
}

/** Allowed embed hostnames — must match security-headers.mjs frame-src. */
export const ALLOWED_EMBED_HOSTS = [
  "vidsrcme.ru",
  "vidsrc.to",
  "vidlink.pro",
  "videasy.to",
  "player.videasy.to",
  "vidfast.pro",
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

/**
 * Wrap a provider URL in our same-origin /api/embed proxy so the iframe loads
 * from our origin. The proxy re-fetches the provider URL server-side, strips
 * any sandbox-detection scripts, and returns the HTML. The provider's real
 * origin is still encoded in the response's `X-Embed-Provider` header so
 * postMessage origin detection (`resolveEmbedSrc`) still works.
 */
export function proxyEmbedUrl(providerUrl: string): string {
  return `/api/embed?src=${encodeURIComponent(providerUrl)}`;
}

/** Extract the real provider URL when loaded through /api/embed proxy. */
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
  // VidSrc's canonical domain is `vidsrcme.ru` (per the current docs).
  // It accepts both IMDB ids (`tt...`) and TMDB ids (numeric). It exposes
  // a `?ds_lang=<iso639-1>` (or comma-separated priority list) parameter
  // that pre-selects subtitle tracks, plus `?sub_url=...` for custom .vtt
  // tracks. `vidsrc.to` is the per-domain mirror documented separately
  // and uses the simpler `?sub_file=...` parameter.
  const allowedLangs = new Set(["en", "sq"]);
  const playerLang = lang && allowedLangs.has(lang) ? lang : "en";

  const vidsrcBase = isTv
    ? `https://vidsrcme.ru/embed/tv/${movieId}/${season}/${episode}`
    : `https://vidsrcme.ru/embed/movie/${movieId}`;
  const vidsrcUrl = `${vidsrcBase}?autoplay=true&ds_lang=${playerLang}`;

  const vidsrcToBase = isTv
    ? `https://vidsrc.to/embed/tv/${movieId}/${season}/${episode}`
    : `https://vidsrc.to/embed/movie/${movieId}`;
  const vidsrcToUrl = `${vidsrcToBase}?autoplay=true`;

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
      // VidSrc (`vidsrcme.ru`) — the canonical VidSrc domain. Accepts both
      // IMDB ids (`tt...`) and TMDB ids (numeric). Uses the `?ds_lang=<iso>`
      // parameter (or comma-separated priority list) to pre-select subtitle
      // tracks, plus `?sub_url=...` for custom .vtt tracks. We pass
      // `?autoplay=true&ds_lang=<en|sq>` so the in-player CC menu opens
      // with the user's preferred language already highlighted.
      id: "vidsrc",
      name: "VidSrc",
      icon: "📺",
      quality: "HD",
      reliability: "high",
      providerUrl: vidsrcUrl,
    },
    {
      // vidsrc.to — per-domain mirror with the same embed API. The docs
      // describe it as using `?sub_file=` instead of `?sub_url=`, but
      // `?autoplay=true` works the same. Kept as a fallback in case the
      // canonical domain is slow or down.
      id: "vidsrc-to",
      name: "VidSrc.to",
      icon: "📺",
      quality: "HD",
      reliability: "medium",
      providerUrl: vidsrcToUrl,
    },
    {
      // Videasy's canonical domain is `player.videasy.to` (the older
      // `player.videasy.net` is deprecated per their docs).
      id: "videasy",
      name: "Videasy",
      icon: "🎬",
      quality: "4K",
      reliability: "high",
      providerUrl: isTv
        ? `https://player.videasy.to/tv/${movieId}/${season}/${episode}?autoplay=true`
        : `https://player.videasy.to/movie/${movieId}?autoplay=true`,
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
      // YapGrid — left as a last-resort fallback per the user. The
      // server tokens (sg_g4 / sx_a1 / sy_b2 / sz_c3) and `?lang=` /
      // `?sub_url=` / `?server=` parameters are all set in the yapgrid.ts
      // builder.
      id: "yapgrid-g",
      name: "YapGrid G",
      icon: "🇦🇱",
      quality: "FHD",
      reliability: "medium",
      providerUrl: yapgridSources[0].providerUrl,
    },
    // Dead / blocked / 404 sources have been removed:
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
    // Route every provider through the same-origin /api/embed proxy so
    // vidsrcme.ru's sbx.js sandbox-detection redirect (and similar
    // anti-embed scripts from other providers) never fires. The
    // `providerUrl` is kept as the raw URL so postMessage origin
    // detection (`resolveEmbedSrc` / `detectProvider`) can still tell
    // which provider the inner page is talking to.
    url: proxyEmbedUrl(s.providerUrl),
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
