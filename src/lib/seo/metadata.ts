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

export function buildPageMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "",
  keywords = DEFAULT_KEYWORDS,
  image,
  index = true,
}: {
  title: string;
  description?: string;
  path?: string;
  keywords?: string[];
  image?: string;
  index?: boolean;
}): Metadata {
  const url = `${SITE_URL}${path}`;
  const ogImages = image
    ? [{ url: image, width: 1200, height: 630, alt: title }]
    : [defaultOgImage(title)];

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
      locale: "en_US",
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
