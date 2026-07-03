import { LazyMovies } from "@/lib/lazy-views";
import { buildPageMetadata } from "@/lib/seo/metadata";

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
  return <LazyMovies />;
}
