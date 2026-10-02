import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/auth", "/profile", "/my-list", "/offline", "/offline-library", "/api/"],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/auth", "/profile", "/my-list", "/offline", "/offline-library"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
