import type { Metadata } from "next";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://flixverse-streaming-pro.vercel.app";

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

export function buildPageMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "",
  keywords = DEFAULT_KEYWORDS,
  image,
}: {
  title: string;
  description?: string;
  path?: string;
  keywords?: string[];
  image?: string;
}): Metadata {
  const url = `${SITE_URL}${path}`;
  const ogImage = image ?? `${SITE_URL}/favicon.svg`;

  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}
