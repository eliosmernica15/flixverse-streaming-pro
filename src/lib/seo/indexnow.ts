import { SITE_URL } from "@/lib/seo/metadata";

/** Public IndexNow key — file must exist at /{KEY}.txt */
export const INDEXNOW_KEY =
  process.env.INDEXNOW_KEY ?? "flixverse8e4a2f1c9b0d3e7";

const INDEXNOW_ENDPOINTS = [
  "https://api.indexnow.org/indexnow",
  "https://www.bing.com/indexnow",
  "https://yandex.com/indexnow",
];

export async function submitUrlsToIndexNow(urls: string[]): Promise<{
  submitted: number;
  results: { endpoint: string; ok: boolean; status?: number }[];
}> {
  if (!urls.length) return { submitted: 0, results: [] };

  const host = new URL(SITE_URL).host;
  const key = INDEXNOW_KEY;
  const keyLocation = `${SITE_URL}/${key}.txt`;

  const body = {
    host,
    key,
    keyLocation,
    urlList: urls.slice(0, 10_000),
  };

  const results = await Promise.all(
    INDEXNOW_ENDPOINTS.map(async (endpoint) => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify(body),
        });
        return { endpoint, ok: res.ok || res.status === 202, status: res.status };
      } catch {
        return { endpoint, ok: false };
      }
    })
  );

  return { submitted: urls.length, results };
}

/** Legacy Google/Bing sitemap ping — still used by some crawlers. */
export async function pingSitemapToSearchEngines(): Promise<void> {
  const sitemapUrl = encodeURIComponent(`${SITE_URL}/sitemap.xml`);
  const pings = [
    `https://www.google.com/ping?sitemap=${sitemapUrl}`,
    `https://www.bing.com/ping?sitemap=${sitemapUrl}`,
  ];

  await Promise.allSettled(pings.map((url) => fetch(url, { method: "GET" })));
}

export async function collectPublicUrls(): Promise<string[]> {
  const { fetchAllSitemapContent } = await import("@/lib/seo/sitemap-tmdb");
  const { BROWSE_CATEGORIES } = await import("@/utils/browseCategories");

  const staticPaths = ["", "/movies", "/tv-shows", "/new-and-popular", "/search"];
  const browsePaths = Object.keys(BROWSE_CATEGORIES).map((c) => `/browse/${c}`);
  const content = await fetchAllSitemapContent();

  const urls = [
    ...staticPaths.map((p) => `${SITE_URL}${p || "/"}`),
    ...browsePaths.map((p) => `${SITE_URL}${p}`),
    ...content.map((item) =>
      item.type === "tv"
        ? `${SITE_URL}/movie/${item.id}?type=tv`
        : `${SITE_URL}/movie/${item.id}`
    ),
  ];

  return [...new Set(urls)];
}
