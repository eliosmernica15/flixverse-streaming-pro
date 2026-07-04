import { LazyNewAndPopular } from "@/lib/lazy-views";
import { buildPageMetadata, SITE_URL } from "@/lib/seo/metadata";
import { CollectionPageJsonLd, WebPageJsonLd } from "@/components/seo/JsonLd";

export const metadata = buildPageMetadata({
  title: "New & Popular Movies and TV Shows — Trending This Week",
  description:
    "Discover what's trending on FlixVerse — new movie releases, popular TV series, and the hottest films everyone is watching. Stream free in HD.",
  path: "/new-and-popular",
  keywords: [
    "trending movies",
    "popular TV shows",
    "new releases",
    "what to watch",
    "hot movies this week",
    "FlixVerse trending",
    "new movies 2026",
  ],
});

export default function NewAndPopularPage() {
  const url = `${SITE_URL}/new-and-popular`;
  return (
    <>
      <WebPageJsonLd
        name="New & Popular on FlixVerse"
        description="Trending movies and TV shows updated weekly."
        url={url}
      />
      <CollectionPageJsonLd
        name="New & Popular Movies and TV Shows"
        description="Trending and newly released titles to stream free on FlixVerse."
        url={url}
      />
      <LazyNewAndPopular />
    </>
  );
}
