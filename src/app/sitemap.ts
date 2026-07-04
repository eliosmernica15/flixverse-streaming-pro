import type { MetadataRoute } from "next";
import { BROWSE_CATEGORIES } from "@/utils/browseCategories";
import { SITE_URL } from "@/lib/seo/metadata";
import { fetchTrendingForSitemap } from "@/lib/seo/sitemap-tmdb";

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

  const trending = await fetchTrendingForSitemap();
  const contentRoutes: MetadataRoute.Sitemap = trending.map((item) => ({
    url: `${SITE_URL}/movie/${item.id}?type=${item.type}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: item.type === "movie" ? 0.78 : 0.75,
  }));

  return [...staticRoutes, ...browseRoutes, ...contentRoutes];
}
