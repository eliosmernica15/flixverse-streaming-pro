import type { Metadata } from "next";
import { Suspense } from "react";
import { LazyMovieDetailsPage } from "@/lib/lazy-views";
import { buildPageMetadata, SITE_URL } from "@/lib/seo/metadata";
import {
  getCachedTmdbSeoContent,
  tmdbBackdropUrl,
  tmdbPosterUrl,
} from "@/lib/seo/tmdb-server";
import { BreadcrumbJsonLd, ContentJsonLd, EpisodeJsonLd, TVSeriesJsonLd } from "@/components/seo/JsonLd";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; season?: string; episode?: string }>;
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
  const { type, season, episode } = await searchParams;
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

  // Check if this is a specific episode request
  const isEpisode = mediaType === "tv" && season && episode;
  const episodeNumber = episode ? parseInt(episode, 10) : undefined;
  const seasonNumber = season ? parseInt(season, 10) : undefined;

  // Build path with all relevant params
  const pathParts = [`/movie/${id}?type=${mediaType}`];
  if (season) pathParts.push(`season=${season}`);
  if (episode) pathParts.push(`episode=${episode}`);
  const path = pathParts.join("&");

  // Genres for OG image
  const genres = content.genres?.map((g) => g.name).join(", ") || "";

  // Build OG params for dynamic image
  const ogParams = {
    type: mediaType === "tv" ? "tv" as const : "movie" as const,
    rating: content.vote_average?.toFixed(1),
    year: content.release_date?.slice(0, 4) || content.first_air_date?.slice(0, 4),
    genres,
    ...(isEpisode && seasonNumber && episodeNumber
      ? {
          season: seasonNumber.toString(),
          episode: episodeNumber.toString(),
        }
      : {}),
  };

  return buildPageMetadata({
    title,
    description,
    path,
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
    ogParams,
  });
}

export default async function MoviePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { type, season, episode } = await searchParams;
  const { content, mediaType } = await resolveContent(Number(id), type);
  const pageUrl = `${SITE_URL}/movie/${id}?type=${mediaType}`;
  const listLabel = mediaType === "tv" ? "TV Shows" : "Movies";
  const listPath = mediaType === "tv" ? "/tv-shows" : "/movies";

  // Check if this is a specific episode request
  const isEpisode = mediaType === "tv" && season && episode;
  const episodeNumber = episode ? parseInt(episode, 10) : undefined;
  const seasonNumber = season ? parseInt(season, 10) : undefined;

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
        <>
          {/* TV Series structured data for TV shows */}
          {mediaType === "tv" && (
            <TVSeriesJsonLd
              name={content.title}
              description={content.overview || ""}
              image={tmdbBackdropUrl(content.backdrop_path) ?? tmdbPosterUrl(content.poster_path, "w780")}
              url={pageUrl}
              datePublished={content.first_air_date}
              rating={content.vote_average}
              numberOfSeasons={content.number_of_seasons}
              numberOfEpisodes={content.number_of_episodes}
              genres={content.genres?.map((g) => g.name)}
              actors={content.credits?.cast?.slice(0, 10).map((c) => ({
                name: c.name,
                url: `${SITE_URL}/person/${c.id}`,
              }))}
              creator={content.credits?.crew
                ?.filter((c) => c.job === "Creator" || c.job === "Executive Producer")
                .slice(0, 5)
                .map((c) => ({
                  name: c.name,
                  url: `${SITE_URL}/person/${c.id}`,
                }))}
            />
          )}

          {/* Episode structured data when season/episode specified */}
          {isEpisode && seasonNumber && episodeNumber && content.seasons && (
            <>
              {content.seasons.map((s) => {
                const ep = s.episodes?.find((e) => e.episode_number === episodeNumber);
                if (ep && s.season_number === seasonNumber) {
                  return (
                    <EpisodeJsonLd
                      key={`${seasonNumber}-${episodeNumber}`}
                      title={ep.name}
                      description={ep.overview}
                      image={ep.still_path ? tmdbBackdropUrl(ep.still_path) : tmdbBackdropUrl(content.backdrop_path) ?? tmdbPosterUrl(content.poster_path, "w780")}
                      url={`${pageUrl}&season=${seasonNumber}&episode=${episodeNumber}`}
                      episodeNumber={ep.episode_number}
                      seasonNumber={s.season_number}
                      seriesName={content.title}
                      seriesUrl={pageUrl}
                      datePublished={ep.air_date}
                      rating={ep.vote_average}
                      duration={ep.runtime ? `PT${ep.runtime}M` : undefined}
                    />
                  );
                }
                return null;
              })}
            </>
          )}

          {/* Movie/TV Series structured data (general) */}
          <ContentJsonLd
            title={content.title}
            description={content.overview}
            image={tmdbBackdropUrl(content.backdrop_path) ?? tmdbPosterUrl(content.poster_path, "w780")}
            url={pageUrl}
            type={mediaType}
            datePublished={content.release_date || content.first_air_date}
            rating={content.vote_average}
          />
        </>
      )}
      <Suspense fallback={<div className="min-h-screen bg-black" />}>
        <LazyMovieDetailsPage />
      </Suspense>
    </>
  );
}
