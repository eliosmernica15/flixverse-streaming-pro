import type { Metadata } from "next";
import { LazyBrowse } from "@/lib/lazy-views";
import { BROWSE_CATEGORIES } from "@/utils/browseCategories";
import { buildPageMetadata } from "@/lib/seo/metadata";

type PageProps = {
  params: Promise<{ category: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  const config = BROWSE_CATEGORIES[category];

  if (!config) {
    return buildPageMetadata({
      title: "Browse Movies & TV Shows",
      path: `/browse/${category}`,
    });
  }

  return buildPageMetadata({
    title: `${config.title} — Watch Free Online`,
    description: `Browse ${config.title.toLowerCase()} on FlixVerse. Stream free movies and TV shows online in HD — trending, top-rated, and new releases.`,
    path: `/browse/${category}`,
    keywords: [config.title, "movies", "TV shows", "stream online", "free movies", "FlixVerse"],
  });
}

export function generateStaticParams() {
  return Object.keys(BROWSE_CATEGORIES).map((category) => ({ category }));
}

export default function BrowsePage() {
  return <LazyBrowse />;
}
