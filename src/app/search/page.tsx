import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchPageSkeleton } from "@/components/skeletons/RouteSkeletons";
import { LazySearchResults } from "@/lib/lazy-views";
import { buildPageMetadata } from "@/lib/seo/metadata";

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams;
  const query = q?.trim();

  if (query) {
    return buildPageMetadata({
      title: `"${query}" — Search Movies & TV Shows`,
      description: `Find movies and TV shows matching "${query}" on FlixVerse. Stream free in HD — films, series, and more.`,
      path: `/search?q=${encodeURIComponent(query)}`,
      keywords: [query, "search movies", "find TV shows", "movie search", "FlixVerse"],
    });
  }

  return buildPageMetadata({
    title: "Search Movies & TV Shows",
    description:
      "Search thousands of movies and TV shows on FlixVerse. Find films, series, actors, and genres — then stream free in HD.",
    path: "/search",
    keywords: ["search movies", "find TV shows", "movie search", "FlixVerse search"],
  });
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageSkeleton />}>
      <LazySearchResults />
    </Suspense>
  );
}
