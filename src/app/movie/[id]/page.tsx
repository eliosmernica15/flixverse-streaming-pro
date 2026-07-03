import type { Metadata } from "next";
import { Suspense } from "react";
import { LazyMovieDetailsPage } from "@/lib/lazy-views";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { fetchTmdbSeoContent, tmdbPosterUrl } from "@/lib/seo/tmdb-server";
import { ContentJsonLd } from "@/components/seo/JsonLd";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const { type } = await searchParams;
  const mediaType = type === "tv" ? "tv" : "movie";
  const content = await fetchTmdbSeoContent(Number(id), mediaType);

  if (!content) {
    return buildPageMetadata({
      title: "Watch Online",
      path: `/movie/${id}`,
    });
  }

  const label = mediaType === "tv" ? "TV Show" : "Movie";
  const title = `Watch ${content.title} — Free ${label} Online in HD`;
  const description =
    content.overview?.slice(0, 155) ||
    `Stream ${content.title} free on FlixVerse. Watch ${label.toLowerCase()}s online in HD with no signup required.`;

  return buildPageMetadata({
    title,
    description,
    path: `/movie/${id}?type=${mediaType}`,
    image: tmdbPosterUrl(content.poster_path, "w780"),
    keywords: [
      content.title,
      `watch ${content.title}`,
      `${content.title} online`,
      "free movies",
      "stream movies",
      mediaType === "tv" ? "TV shows" : "movies",
    ],
  });
}

export default async function MoviePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { type } = await searchParams;
  const mediaType = type === "tv" ? "tv" : "movie";
  const content = await fetchTmdbSeoContent(Number(id), mediaType);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://flixverse-streaming-pro.vercel.app";

  return (
    <>
      {content && (
        <ContentJsonLd
          title={content.title}
          description={content.overview}
          image={tmdbPosterUrl(content.poster_path, "w780")}
          url={`${siteUrl}/movie/${id}?type=${mediaType}`}
          type={mediaType}
        />
      )}
      <Suspense fallback={<div className="min-h-screen bg-black" />}>
        <LazyMovieDetailsPage />
      </Suspense>
    </>
  );
}
