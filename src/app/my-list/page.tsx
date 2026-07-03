import { LazyMyList } from "@/lib/lazy-views";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "My List — Your Saved Movies & TV Shows",
  description:
    "Your personal watchlist on FlixVerse. Save movies and TV shows to watch later — synced across devices when you sign in.",
  path: "/my-list",
  keywords: ["watchlist", "my list", "saved movies", "FlixVerse"],
});

export default function MyListPage() {
  return <LazyMyList />;
}
