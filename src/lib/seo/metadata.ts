import type { Metadata } from "next";

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://flixverse-streaming-pro.vercel.app"
)
  .trim()
  .replace(/\/$/, "");

export const SITE_NAME = "FlixVerse";

export const DEFAULT_DESCRIPTION =
  "Watch free movies and TV shows online in HD. Stream trending films, top-rated series, new releases, and build your personal watchlist on FlixVerse.";

export const DEFAULT_KEYWORDS = [
  "movies",
  "watch movies online",
  "free movies",
  "TV shows",
  "stream movies",
  "HD movies",
  "FlixVerse",
  "movie streaming",
  "watch TV online",
  "trending movies",
  "new movies",
  "film streaming",
];

// Supported locales for hreflang
export const SUPPORTED_LOCALES = ["en", "es", "sq"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const INDEX_ROBOTS: Metadata["robots"] = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-video-preview": -1,
    "max-image-preview": "large",
    "max-snippet": -1,
  },
};

export const NOINDEX_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
};

function defaultOgImage(title: string) {
  return {
    url: "/opengraph-image",
    width: 1200,
    height: 630,
    alt: title,
  };
}

/**
 * Build dynamic OG image URL using the /api/og endpoint
 */
export function buildOgImageUrl(params: {
  title: string;
  description?: string;
  type?: "movie" | "tv" | "person" | "collection" | "website";
  image?: string;
  rating?: string;
  year?: string;
  genres?: string;
  season?: string;
  episode?: string;
  episodeTitle?: string;
  episodeOverview?: string;
  personName?: string;
  knownFor?: string;
  collectionName?: string;
  partCount?: string;
}): string {
  const searchParams = new URLSearchParams();
  searchParams.set("title", params.title);
  if (params.description) searchParams.set("description", params.description);
  if (params.type) searchParams.set("type", params.type);
  if (params.image) searchParams.set("image", params.image);
  if (params.rating) searchParams.set("rating", params.rating);
  if (params.year) searchParams.set("year", params.year);
  if (params.genres) searchParams.set("genres", params.genres);
  if (params.season) searchParams.set("season", params.season);
  if (params.episode) searchParams.set("episode", params.episode);
  if (params.episodeTitle) searchParams.set("episodeTitle", params.episodeTitle);
  if (params.episodeOverview) searchParams.set("episodeOverview", params.episodeOverview);
  if (params.personName) searchParams.set("personName", params.personName);
  if (params.knownFor) searchParams.set("knownFor", params.knownFor);
  if (params.collectionName) searchParams.set("collectionName", params.collectionName);
  if (params.partCount) searchParams.set("partCount", params.partCount);

  return `${SITE_URL}/api/og?${searchParams.toString()}`;
}

/**
 * Build hreflang alternates for a given path
 */
export function buildHreflangAlternates(path: string): Metadata["alternates"] {
  const alternates: Record<string, string> = {};

  // Add each supported locale
  for (const locale of SUPPORTED_LOCALES) {
    const localePath = locale === "en" ? path : `/${locale}${path}`;
    alternates[locale] = `${SITE_URL}${localePath}`;
  }

  // x-default points to English version
  alternates["x-default"] = `${SITE_URL}${path}`;

  // Also include canonical
  alternates.canonical = `${SITE_URL}${path}`;

  return alternates;
}

export function buildPageMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "",
  keywords = DEFAULT_KEYWORDS,
  image,
  index = true,
  type = "website",
  locale = "en_US",
  useDynamicOg = true,
  ogParams,
}: {
  title: string;
  description?: string;
  path?: string;
  keywords?: string[];
  image?: string;
  index?: boolean;
  type?: "website" | "article" | "profile" | "movie" | "tv_show";
  locale?: string;
  useDynamicOg?: boolean;
  ogParams?: {
    type?: "movie" | "tv" | "person" | "collection" | "website";
    rating?: string;
    year?: string;
    genres?: string;
    season?: string;
    episode?: string;
    episodeTitle?: string;
    episodeOverview?: string;
    personName?: string;
    knownFor?: string;
    collectionName?: string;
    partCount?: string;
  };
}): Metadata {
  // Map internal types to valid Next.js Open Graph types
  const ogType: "website" | "article" | "profile" =
    type === "movie" || type === "tv_show" ? "website" : type;
  const url = `${SITE_URL}${path}`;

  // Determine OG image - use dynamic OG if enabled and params provided
  let ogImages: Metadata["openGraph"]["images"];
  if (useDynamicOg && ogParams) {
    const dynamicOgUrl = buildOgImageUrl({
      title,
      description,
      ...ogParams,
      image: image,
    });
    ogImages = [{ url: dynamicOgUrl, width: 1200, height: 630, alt: title }];
  } else if (image) {
    ogImages = [{ url: image, width: 1200, height: 630, alt: title }];
  } else {
    ogImages = [defaultOgImage(title)];
  }

  return {
    title,
    description,
    keywords,
    alternates: buildHreflangAlternates(path),
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: ogType,
      locale,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : ["/opengraph-image"],
    },
    robots: index ? INDEX_ROBOTS : NOINDEX_ROBOTS,
  };
}

export function buildPrivatePageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return buildPageMetadata({ title, description, path, index: false });
}
