import type { MetadataRoute } from "next";
import { BROWSE_CATEGORIES } from "@/utils/browseCategories";
import { SITE_URL } from "@/lib/seo/metadata";
import { fetchAllSitemapContent } from "@/lib/seo/sitemap-tmdb";

/** Build sitemap at deploy time — avoids runtime TMDB timeouts on Vercel. */
export const dynamic = "force-static";

function contentUrl(item: { id: number; type: "movie" | "tv" }) {
  return item.type === "tv"
    ? `${SITE_URL}/movie/${item.id}?type=tv`
    : `${SITE_URL}/movie/${item.id}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/movies`, lastModified, changeFrequency: "daily", priority: 0.95 },
    { url: `${SITE_URL}/tv-shows`, lastModified, changeFrequency: "daily", priority: 0.95 },
    { url: `${SITE_URL}/new-and-popular`, lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/search`, lastModified, changeFrequency: "weekly", priority: 0.75 },
  ];

  const browseRoutes: MetadataRoute.Sitemap = Object.keys(BROWSE_CATEGORIES).map((category) => ({
    url: `${SITE_URL}/browse/${category}`,
    lastModified,
    changeFrequency: "daily" as const,
    priority: 0.85,
  }));

  let contentRoutes: MetadataRoute.Sitemap = [];
  try {
    const content = await fetchAllSitemapContent();
    contentRoutes = content.map((item) => ({
      url: contentUrl(item),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: item.type === "movie" ? 0.78 : 0.75,
    }));
  } catch {
    // Static + browse routes still ship if TMDB is unavailable
  }

  return [...staticRoutes, ...browseRoutes, ...contentRoutes];
}
