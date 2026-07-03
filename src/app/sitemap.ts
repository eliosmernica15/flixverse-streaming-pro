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
    { url: `${SITE_URL}/my-list`, lastModified, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/offline-library`, lastModified, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/auth`, lastModified, changeFrequency: "monthly", priority: 0.4 },
  ];

  const browseRoutes: MetadataRoute.Sitemap = Object.keys(BROWSE_CATEGORIES).map((category) => ({
    url: `${SITE_URL}/browse/${category}`,
    lastModified,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  const trending = await fetchTrendingForSitemap();
  const contentRoutes: MetadataRoute.Sitemap = trending.map((item) => ({
    url: `${SITE_URL}/movie/${item.id}?type=${item.type}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...browseRoutes, ...contentRoutes];
}
