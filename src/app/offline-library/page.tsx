import { LazyOfflineLibrary } from "@/lib/lazy-views";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Offline Library — Browse Saved Movies Without Internet",
  description:
    "Access your cached watchlist and continue-watching titles offline on FlixVerse. Browse posters and saved pages when you're without a connection.",
  path: "/offline-library",
  keywords: ["offline movies", "watchlist offline", "FlixVerse offline", "cached movies"],
});

export default function OfflineLibraryPage() {
  return <LazyOfflineLibrary />;
}
