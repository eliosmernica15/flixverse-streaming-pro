import { LazyNewAndPopular } from "@/lib/lazy-views";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "New & Popular Movies and TV Shows",
  description:
    "Discover trending and new movies and TV shows on FlixVerse. What's hot this week — stream popular films and series free in HD.",
  path: "/new-and-popular",
  keywords: ["trending movies", "popular TV shows", "new releases", "what to watch", "FlixVerse"],
});

export default function NewAndPopularPage() {
  return <LazyNewAndPopular />;
}
