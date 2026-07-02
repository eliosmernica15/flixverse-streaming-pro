"use client";

import { useParams, useRouter } from "next/navigation";
import MovieCard from "@/components/MovieCard";
import PageContainer from "@/components/PageContainer";
import { Sparkles, AlertCircle } from "lucide-react";
import { useBrowseCategory, getBrowseCategoryConfig } from "@/hooks/queries/useBrowseCategory";

const Browse = () => {
  const { category } = useParams<{ category: string }>();
  const router = useRouter();
  const config = getBrowseCategoryConfig(category);
  const { data: movies = [], isLoading, isError, refetch } = useBrowseCategory(category);

  if (!category) {
    return (
      <div className="pt-24 px-4 flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-gray-400 mb-4">No category specified.</p>
        <button onClick={() => router.push("/")} className="text-red-500 hover:text-red-400 font-medium">
          Go home
        </button>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="pt-24 px-4 flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-gray-400 mb-4">Category not found.</p>
        <button onClick={() => router.push("/")} className="text-red-500 hover:text-red-400 font-medium">
          Go home
        </button>
      </div>
    );
  }

  return (
    <>
      <header className="relative pt-20 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1800px] mx-auto flex items-center gap-4">
          <div className="p-2.5 bg-gradient-to-br from-red-500/20 to-purple-500/10 rounded-xl border border-white/5">
            <Sparkles className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">{config.title}</h1>
            <p className="text-gray-500 text-sm mt-1">
              {isLoading ? "Loading..." : `${movies.length} title${movies.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
      </header>

      <PageContainer className="!pt-0">

        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-2xl skeleton-shimmer" />
            ))}
          </div>
        )}

        {isError && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-gray-400 mb-4">Failed to load content.</p>
            <button onClick={() => refetch()} className="text-red-500 hover:text-red-400 font-medium">
              Try again
            </button>
          </div>
        )}

        {!isLoading && !isError && movies.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 content-auto">
            {movies.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                comingSoon={category === "coming-soon" || category === "upcoming"}
              />
            ))}
          </div>
        )}

        {!isLoading && !isError && movies.length === 0 && (
          <div className="text-center py-20 text-gray-500 glass-card rounded-2xl border border-white/8">
            <p>No titles in this category right now.</p>
          </div>
        )}
      </PageContainer>
    </>
  );
};

export default Browse;
