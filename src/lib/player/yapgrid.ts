/**
 * YapGrid embed URLs — only documented parameters.
 * Movie: /embed/movie/{id}
 * TV: /embed/movie/{id} is wrong; TV is /embed/tv/{id}/{season}/{episode}
 * Params: autoplay, server=x|y|z, lang, title, theme
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
  autoplay?: boolean;
}): string {
  const { movieId, mediaType, season, episode, server, lang, title, autoplay = true } = opts;
  const isTv = mediaType === "tv" && season && episode;
  const path = isTv
    ? `https://yapgrid.com/embed/tv/${movieId}/${season}/${episode}`
    : `https://yapgrid.com/embed/movie/${movieId}`;

  const params = new URLSearchParams();
  if (autoplay) params.set("autoplay", "true");
  params.set("server", server);
  if (lang) params.set("lang", lang);
  if (title) params.set("title", title);

  return `${path}?${params.toString()}`;
}
