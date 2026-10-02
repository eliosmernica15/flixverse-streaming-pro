import { SITE_NAME, SITE_URL, DEFAULT_DESCRIPTION } from "@/lib/seo/metadata";

export function GET() {
  const body = `# ${SITE_NAME}

> ${DEFAULT_DESCRIPTION}

## Public pages
- Home: ${SITE_URL}/
- Movies: ${SITE_URL}/movies
- TV Shows: ${SITE_URL}/tv-shows
- New & Popular: ${SITE_URL}/new-and-popular
- Search: ${SITE_URL}/search

## Sitemap
- ${SITE_URL}/sitemap.xml

## About
FlixVerse is a free movie and TV streaming discovery platform. Users can browse trending films, build watchlists, and stream via embedded players.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
