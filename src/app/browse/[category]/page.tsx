import type { Metadata } from "next";
import { LazyBrowse } from "@/lib/lazy-views";
import { BROWSE_CATEGORIES } from "@/utils/browseCategories";
import { buildPageMetadata, SITE_URL } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd, CollectionPageJsonLd, ItemListJsonLd } from "@/components/seo/JsonLd";
import { tmdbPosterUrl } from "@/lib/seo/tmdb-server";

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

  const isTvCategory = /tv|series|shows|airing|air/i.test(category);

  return buildPageMetadata({
    title: `${config.title} — Watch Free ${isTvCategory ? "TV Shows" : "Movies"} Online in HD`,
    description: `Stream ${config.title.toLowerCase()} free on FlixVerse. Watch ${isTvCategory ? "TV series and episodes" : "HD movies"} online — trending picks, top-rated titles, and new releases updated daily.`,
    path: `/browse/${category}`,
    keywords: [
      config.title,
      isTvCategory ? "TV shows" : "movies",
      `watch ${config.title.toLowerCase()} online`,
      "free streaming",
      "HD",
      "FlixVerse",
      "stream online",
    ],
  });
}

export function generateStaticParams() {
  return Object.keys(BROWSE_CATEGORIES).map((category) => ({ category }));
}

export default async function BrowsePage({ params }: PageProps) {
  const { category } = await params;
  const config = BROWSE_CATEGORIES[category];
  const pageUrl = `${SITE_URL}/browse/${category}`;

  let listItems: { name: string; url: string; image?: string }[] = [];
  if (config) {
    try {
      const results = await config.fetch();
      listItems = results.slice(0, 20).map((item) => {
        const mediaType = item.media_type === "tv" || item.name ? "tv" : "movie";
        const name = item.title || item.name || "Title";
        return {
          name,
          url: `${SITE_URL}/movie/${item.id}?type=${mediaType}`,
          image: tmdbPosterUrl(item.poster_path, "w500"),
        };
      });
    } catch {
      listItems = [];
    }
  }

  return (
    <>
      {config && (
        <>
          <BreadcrumbJsonLd
            items={[
              { name: "Home", url: SITE_URL },
              { name: config.title, url: pageUrl },
            ]}
          />
          <CollectionPageJsonLd
            name={`${config.title} on FlixVerse`}
            description={`Browse and stream ${config.title.toLowerCase()} free in HD.`}
            url={pageUrl}
          />
          {listItems.length > 0 && (
            <ItemListJsonLd
              name={config.title}
              description={`Top ${config.title.toLowerCase()} to watch on FlixVerse`}
              url={pageUrl}
              items={listItems}
            />
          )}
        </>
      )}
      <LazyBrowse />
    </>
  );
}
