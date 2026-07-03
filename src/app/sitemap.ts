import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://flixverse-streaming-pro.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: siteUrl, lastModified, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/movies`, lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/tv-shows`, lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/new-and-popular`, lastModified, changeFrequency: "daily", priority: 0.85 },
    { url: `${siteUrl}/search`, lastModified, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/auth`, lastModified, changeFrequency: "monthly", priority: 0.4 },
  ];
}
