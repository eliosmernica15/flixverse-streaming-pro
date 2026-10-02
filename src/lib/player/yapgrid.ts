/**
 * YapGrid embed URLs.
 *
 * Server tokens — these are the real tokens, not the short `x`/`y`/`z`
 * labels shown in the dashboard. The short labels are display-only; the
 * `?server=` parameter on the embed URL must use the long tokens or YapGrid
 * will silently fall back to "auto" (which is what was giving us Hindi
 * audio even on the live site's English-default servers).
 *
 *   sx_a1  = X (Primary CDN, secure routing)
 *   sy_b2  = Y (Backup CDN, smart fallback)
 *   sz_c3  = Z (Edge CDN, direct CDN, often the Hindi-dubbed mirror)
 *   sg_g4  = G (Vidrock Edge, direct MP4 — YapGrid's own test player
 *               uses this as the default. Direct MP4 = multiple audio
 *               tracks, English audio on popular titles)
 *
 * Params: autoplay, server, lang, title, theme, sub_url, sub_lang, sub_label
 */
export const YAPGRID_LANES = [
  { token: "sg_g4", id: "g", label: "G" }, // Vidrock Edge (direct MP4, default)
  { token: "sx_a1", id: "x", label: "X" }, // Primary CDN
  { token: "sy_b2", id: "y", label: "Y" }, // Backup CDN
  { token: "sz_c3", id: "z", label: "Z" }, // Edge CDN (often Hindi-dubbed)
] as const;

export type YapGridLaneId = (typeof YAPGRID_LANES)[number]["id"];
export type YapGridLane = (typeof YAPGRID_LANES)[number];

export function buildYapGridEmbedUrl(opts: {
  movieId: number;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
  /** YapGrid's actual server token (e.g. "sg_g4"), not the short label. */
  server: string;
  lang?: string;
  title?: string;
  theme?: string;
  autoplay?: boolean;
  subUrl?: string;
  subLang?: string;
  subLabel?: string;
}): string {
  const { movieId, mediaType, season, episode, server, lang, title, theme, autoplay = true, subUrl, subLang, subLabel } = opts;
  const isTv = mediaType === "tv" && season && episode;
  const path = isTv
    ? `https://yapgrid.com/embed/tv/${movieId}/${season}/${episode}`
    : `https://yapgrid.com/embed/movie/${movieId}`;

  const params = new URLSearchParams();
  if (autoplay) params.set("autoplay", "true");
  params.set("server", server);
  if (lang) params.set("lang", lang);
  if (title) params.set("title", encodeURIComponent(title));
  if (theme) params.set("theme", theme);
  if (subUrl) {
    params.set("sub_url", encodeURIComponent(subUrl));
    if (subLang) params.set("sub_lang", subLang);
    if (subLabel) params.set("sub_label", subLabel);
  }

  return `${path}?${params.toString()}`;
}
