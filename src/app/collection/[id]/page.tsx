import type { Metadata } from "next";
import { Suspense } from "react";
import { LazyCollectionDetailsPage } from "@/lib/lazy-views";
import { buildPageMetadata, SITE_URL } from "@/lib/seo/metadata";
import {
  getCachedTmdbSeoContent,
  tmdbBackdropUrl,
  tmdbPosterUrl,
} from "@/lib/seo/tmdb-server";
import { BreadcrumbJsonLd, CollectionJsonLd } from "@/components/seo/JsonLd";
import { fetchCollectionDetails } from "@/utils/tmdbApi";

type PageProps = {
  params: Promise<{ id: string }>;
};

async function resolveCollection(id: number) {
  return await fetchCollectionDetails(id);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const collection = await resolveCollection(Number(id));

  if (!collection) {
    return buildPageMetadata({
      title: "Collection | FlixVerse",
      path: `/collection/${id}`,
    });
  }

  const title = `${collection.name} — Watch Collection Online Free in HD`;
  const description =
    collection.overview?.slice(0, 155) ||
    `Watch the ${collection.name} collection free on FlixVerse. Stream ${collection.part_count} titles in HD with no signup required.`;

  // Build OG params for dynamic image
  const ogParams = {
    type: "collection" as const,
    collectionName: collection.name,
    partCount: collection.part_count?.toString(),
  };

  return buildPageMetadata({
    title,
    description,
    path: `/collection/${id}`,
    image: tmdbBackdropUrl(collection.backdrop_path) ?? tmdbPosterUrl(collection.poster_path, "w780"),
    keywords: [
      collection.name,
      `watch ${collection.name}`,
      `${collection.name} collection`,
      `${collection.name} free`,
      "free movies",
      "stream movies",
      "movie collection",
      "TV collection",
    ],
    ogParams,
  });
}

export default async function CollectionPage({ params }: PageProps) {
  const { id } = await params;
  const collection = await resolveCollection(Number(id));
  const pageUrl = `${SITE_URL}/collection/${id}`;

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: SITE_URL },
          { name: "Search", url: `${SITE_URL}/search` },
          { name: collection?.name ?? "Collection", url: pageUrl },
        ]}
      />
      {collection && (
        <CollectionJsonLd
          name={collection.name}
          description={collection.overview || ""}
          image={tmdbBackdropUrl(collection.backdrop_path) ?? tmdbPosterUrl(collection.poster_path, "w780")}
          url={pageUrl}
          numberOfItems={collection.part_count}
          hasPart={collection.parts?.map((part) => ({
            name: part.title || part.name || "Unknown",
            url: `${SITE_URL}/movie/${part.id}?type=${part.media_type || (part.title ? "movie" : "tv")}`,
            type: (part.media_type === "tv" || part.first_air_date) ? "TVSeries" : "Movie",
          }))}
        />
      )}
      <Suspense fallback={<div className="min-h-screen bg-black" />}>
        <LazyCollectionDetailsPage collectionId={Number(id)} />
      </Suspense>
    </>
  );
}