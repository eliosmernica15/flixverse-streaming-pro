import type { Metadata } from "next";
import { Suspense } from "react";
import { LazyMovieDetailsPage } from "@/lib/lazy-views";
import { buildPageMetadata, SITE_URL } from "@/lib/seo/metadata";
import {
  getCachedTmdbSeoContent,
  tmdbBackdropUrl,
  tmdbPosterUrl,
} from "@/lib/seo/tmdb-server";
import { BreadcrumbJsonLd, ContentJsonLd } from "@/components/seo/JsonLd";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
};

async function resolveContent(id: number, type?: string) {
  const mediaType = type === "tv" ? "tv" : "movie";
  let content = await getCachedTmdbSeoContent(id, mediaType);
  if (!content && !type) {
    content = await getCachedTmdbSeoContent(id, mediaType === "movie" ? "tv" : "movie");
  }
  const resolvedType = content?.media_type ?? mediaType;
  return { content, mediaType: resolvedType };
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const { type } = await searchParams;
  const { content, mediaType } = await resolveContent(Number(id), type);

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
    image: tmdbBackdropUrl(content.backdrop_path) ?? tmdbPosterUrl(content.poster_path, "w780"),
    keywords: [
      content.title,
      `watch ${content.title}`,
      `${content.title} online`,
      `${content.title} free`,
      "free movies",
      "stream movies",
      mediaType === "tv" ? "TV shows" : "movies",
    ],
  });
}

export default async function MoviePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { type } = await searchParams;
  const { content, mediaType } = await resolveContent(Number(id), type);
  const pageUrl = `${SITE_URL}/movie/${id}?type=${mediaType}`;
  const listLabel = mediaType === "tv" ? "TV Shows" : "Movies";
  const listPath = mediaType === "tv" ? "/tv-shows" : "/movies";

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: SITE_URL },
          { name: listLabel, url: `${SITE_URL}${listPath}` },
          { name: content?.title ?? "Title", url: pageUrl },
        ]}
      />
      {content && (
        <ContentJsonLd
          title={content.title}
          description={content.overview}
          image={tmdbBackdropUrl(content.backdrop_path) ?? tmdbPosterUrl(content.poster_path, "w780")}
          url={pageUrl}
          type={mediaType}
          datePublished={content.release_date || content.first_air_date}
          rating={content.vote_average}
        />
      )}
      <Suspense fallback={<div className="min-h-screen bg-black" />}>
        <LazyMovieDetailsPage />
      </Suspense>
    </>
  );
}
