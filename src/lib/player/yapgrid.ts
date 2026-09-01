/**
 * YapGrid embed URLs — only documented parameters.
 * Movie: /embed/movie/{id}
 * TV: /embed/movie/{id} is wrong; TV is /embed/tv/{id}/{season}/{episode}
 * Params: autoplay, server=x|y|z, lang, title, theme, sub_url, sub_lang, sub_label
 * server=g is not in their parameters docs — do not use it.
 */
export const YAPGRID_LANES = ["z", "x", "y"] as const;
export type YapGridLane = (typeof YAPGRID_LANES)[number];

export function buildYapGridEmbedUrl(opts: {
  movieId: number;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
  server: YapGridLane;
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
