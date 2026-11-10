"use client";

import { useEffect, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import { Play, ChevronLeft, Plus, Check, MoreHorizontal } from "lucide-react";
import { getContentImage, TMDBMovie, TMDBCollection, fetchCollectionDetails } from "@/utils/tmdbApi";
import { useToast } from "@/hooks/use-toast";
import SectionHeader from "@/components/SectionHeader";
import Stagger from "@/components/Stagger";
import MovieCard from "@/components/MovieCard";

interface CollectionDetailsPageProps {
  collectionId: number;
}

export const CollectionDetailsPage = ({ collectionId }: CollectionDetailsPageProps) => {
  const t = useTranslations("collection");
  const router = useRouter();
  const { toast } = useToast();
  const [collection, setCollection] = useState<TMDBCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await fetchCollectionDetails(collectionId);
        if (data) {
          setCollection(data);
        } else {
          setError(true);
          notFound();
        }
      } catch {
        setError(true);
        notFound();
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [collectionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <div className="relative">
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/80 via-black to-black" />
          <div className="absolute top-4 left-4 z-20">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 backdrop-blur border border-white/10 text-white hover:bg-white/20 transition-colors focus-ring"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="hidden sm:block text-sm font-medium">{t("back")}</span>
            </button>
          </div>
          <div className="pt-32 pb-16 px-4 sm:px-6 lg:px-10 max-w-[1800px] mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <div className="aspect-[2/3] rounded-xl overflow-hidden bg-white/5 ring-1 ring-white/10 skeleton-shimmer" />
              </div>
              <div className="lg:col-span-2 space-y-4">
                <div className="h-10 w-3/4 lg:w-1/2 rounded skeleton-shimmer" />
                <div className="h-6 w-full lg:w-3/4 rounded skeleton-shimmer" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !collection) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="relative">
        {/* Backdrop */}
        <div
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage: collection.backdrop_path
              ? `url(${getContentImage(collection, "backdrop", "large")})`
              : "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black" />
        </div>

        {/* Back button */}
        <div className="absolute top-4 left-4 z-20">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 backdrop-blur border border-white/10 text-white hover:bg-white/20 transition-colors focus-ring"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden sm:block text-sm font-medium">{t("back")}</span>
          </button>
        </div>

        {/* Main content */}
        <div className="pt-32 pb-16 px-4 sm:px-6 lg:px-10 max-w-[1800px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Poster */}
            <div className="lg:col-span-1">
              <div className="aspect-[2/3] rounded-xl overflow-hidden bg-white/5 ring-1 ring-white/10 relative">
                {collection.poster_path ? (
                  <Image
                    src={getContentImage(collection, "poster", "large")}
                    alt={collection.name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    className="object-cover"
                    priority
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-500/20 to-purple-500/20" />
                )}
                {/* Part count badge */}
                <div className="absolute bottom-4 right-4 rounded-full bg-black/80 backdrop-blur px-3 py-1 text-sm font-medium text-white">
                  {collection.part_count} {t("titles", { count: collection.part_count })}
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="lg:col-span-2">
              <div className="flex items-start gap-4 mb-6">
                <div className="flex-1">
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white mb-3">
                    {collection.name}
                  </h1>
                  {collection.overview && (
                    <p className="text-gray-300 text-lg leading-relaxed max-w-3xl mb-6 line-clamp-4">
                      {collection.overview}
                    </p>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 mb-8">
                <button className="flex items-center gap-2 px-6 py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors focus-ring">
                  <Play className="w-5 h-5" />
                  {t("playAll")}
                </button>
                <button className="flex items-center gap-2 px-6 py-3 rounded-lg bg-white/10 border border-white/20 text-white font-medium hover:bg-white/20 transition-colors focus-ring">
                  <Plus className="w-5 h-5" />
                  <span className="hidden sm:inline">{t("addToList")}</span>
                </button>
                <button className="flex items-center gap-2 px-6 py-3 rounded-lg bg-white/10 border border-white/20 text-white font-medium hover:bg-white/20 transition-colors focus-ring">
                  <MoreHorizontal className="w-5 h-5" />
                  <span className="hidden sm:inline">{t("moreInfo")}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Collection titles */}
          {collection.parts && collection.parts.length > 0 && (
            <section className="mt-12 content-auto">
              <SectionHeader title={t("titlesInCollection")} eyebrow={`${collection.part_count} ${t("titles", { count: collection.part_count })}`} />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 mt-3">
                <Stagger>
                  {collection.parts.map((item) => (
                    <MovieCard key={`${item.id}-${item.media_type}`} movie={item} />
                  ))}
                </Stagger>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default CollectionDetailsPage;