import { LazyOfflineLibrary } from "@/lib/lazy-views";
import { buildPrivatePageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPrivatePageMetadata({
  title: "Offline Library",
  description: "Browse your cached watchlist and saved titles when offline on FlixVerse.",
  path: "/offline-library",
});

export default function OfflineLibraryPage() {
  return (
    <div className="page-enter">
      <LazyOfflineLibrary />
    </div>
  );
}
