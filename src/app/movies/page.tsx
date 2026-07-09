import { LazyMovies } from "@/lib/lazy-views";
import { buildPageMetadata, SITE_URL } from "@/lib/seo/metadata";
import { CollectionPageJsonLd } from "@/components/seo/JsonLd";

export const metadata = buildPageMetadata({
  title: "Free Movies Online — Stream HD Films",
  description:
    "Watch free movies online in HD on FlixVerse. Browse trending films, new releases, top-rated picks, action, comedy, horror, and more — stream anytime.",
  path: "/movies",
  keywords: [
    "movies",
    "free movies",
    "watch movies online",
    "HD movies",
    "stream movies",
    "new movies",
    "trending movies",
    "movie streaming",
  ],
});

export default function MoviesPage() {
  return (
    <>
      <CollectionPageJsonLd
        name="Free Movies Online"
        description="Browse and stream free HD movies — trending, top-rated, genre collections, and new releases on FlixVerse."
        url={`${SITE_URL}/movies`}
      />
      <div className="page-enter">
        <LazyMovies />
      </div>
    </>
  );
}
