import { LazyTVShows } from "@/lib/lazy-views";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Free TV Shows Online — Stream Series in HD",
  description:
    "Watch free TV shows and series online on FlixVerse. Trending dramas, comedies, sci-fi, crime, documentaries, and more — stream episodes anytime.",
  path: "/tv-shows",
  keywords: [
    "TV shows",
    "watch TV online",
    "free TV series",
    "stream TV shows",
    "series online",
    "binge watch",
    "FlixVerse",
  ],
});

export default function TVShowsPage() {
  return <LazyTVShows />;
}
