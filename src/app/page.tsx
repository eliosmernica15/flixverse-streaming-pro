import Index from "@/views/Index";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "FlixVerse — Watch Free Movies & TV Shows Online in HD",
  description:
    "FlixVerse is your free movie and TV streaming platform. Watch trending films, top-rated series, new releases, and build your watchlist — fast, secure, and works offline.",
  path: "/",
  keywords: [
    "movies",
    "watch movies online",
    "free movies",
    "TV shows",
    "stream movies",
    "movie streaming site",
    "FlixVerse",
    "HD streaming",
    "watch films online",
  ],
});

export default function Home() {
  return <Index />;
}
