import { LazyMyList } from "@/lib/lazy-views";
import { buildPrivatePageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPrivatePageMetadata({
  title: "My List — Your Saved Movies & TV Shows",
  description: "Your personal watchlist on FlixVerse. Save movies and TV shows to watch later.",
  path: "/my-list",
});

export default function MyListPage() {
  return <LazyMyList />;
}
