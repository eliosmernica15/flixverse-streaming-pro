import { Suspense } from "react";
import { SearchPageSkeleton } from "@/components/skeletons/RouteSkeletons";
import { LazySearchResults } from "@/lib/lazy-views";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Search Movies & TV Shows",
  description:
    "Search thousands of movies and TV shows on FlixVerse. Find films, series, actors, and genres — then stream free in HD.",
  path: "/search",
  keywords: ["search movies", "find TV shows", "movie search", "FlixVerse search"],
});

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageSkeleton />}>
      <LazySearchResults />
    </Suspense>
  );
}
