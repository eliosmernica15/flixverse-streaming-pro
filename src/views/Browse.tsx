"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import MovieCard from "@/components/MovieCard";
import PageContainer from "@/components/PageContainer";
import Reveal from "@/components/Reveal";
import { Sparkles, AlertCircle, ArrowDownWideNarrow, Star, CalendarDays, ArrowDownAZ } from "lucide-react";
import { useBrowseCategory, getBrowseCategoryConfig } from "@/hooks/queries/useBrowseCategory";

type SortKey = "featured" | "rating" | "newest" | "az";

const Browse = () => {
  const { category } = useParams<{ category: string }>();
  const router = useRouter();
  const t = useTranslations("browse");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const config = getBrowseCategoryConfig(category);
  const { data: movies = [], isLoading, isError, refetch } = useBrowseCategory(category);
  const [sort, setSort] = useState<SortKey>("featured");

  const sorts = useMemo<{ key: SortKey; label: string; icon: ReactNode }[]>(
    () => [
      { key: "featured", label: t("featured"), icon: <Sparkles className="w-3.5 h-3.5" /> },
      { key: "rating", label: t("topRated"), icon: <Star className="w-3.5 h-3.5" /> },
      { key: "newest", label: t("newest"), icon: <CalendarDays className="w-3.5 h-3.5" /> },
      { key: "az", label: t("az"), icon: <ArrowDownAZ className="w-3.5 h-3.5" /> },
    ],
    [t]
  );

  const categoryTitle = useMemo(() => {
    if (!category || !config) return "";
    return t.has(category as never) ? t(category as never) : config.title;
  }, [category, config, t]);

  const sortedMovies = useMemo(() => {
    if (sort === "featured") return movies;
    const copy = [...movies];
    switch (sort) {
      case "rating":
        return copy.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
      case "newest":
        return copy.sort(
          (a, b) =>
            new Date(b.release_date || b.first_air_date || 0).getTime() -
            new Date(a.release_date || a.first_air_date || 0).getTime()
        );
      case "az":
        return copy.sort((a, b) =>
          (a.title || a.name || "").localeCompare(b.title || b.name || "")
        );
      default:
        return copy;
    }
  }, [movies, sort]);

  if (!category) {
    return (
      <div className="pt-24 px-4 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="glass-panel p-10 rounded-3xl text-center max-w-md w-full">
          <p className="text-gray-300 mb-4">{t("noCategory")}</p>
          <button
            onClick={() => router.push("/")}
            className="btn-primary min-h-[44px] px-6 py-3 focus-ring"
          >
            {tn("home")}
          </button>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="pt-24 px-4 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="glass-panel p-10 rounded-3xl text-center max-w-md w-full">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-300 mb-4">{t("noCategory")}</p>
          <button
            onClick={() => router.push("/")}
            className="btn-primary min-h-[44px] px-6 py-3 focus-ring"
          >
            {tn("home")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <header className="relative pt-24 pb-6 px-4 sm:px-6 lg:px-10">
        <div className="max-w-[1800px] mx-auto flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-white/5 ring-1 ring-white/10">
            <Sparkles className="w-5 h-5 text-red-500" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight truncate">{categoryTitle}</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {isLoading ? tc("loading") : t("titles", { count: movies.length })}
            </p>
          </div>
        </div>
      </header>

      <PageContainer className="!pt-0">
        <div className="glass-soft rounded-lg p-2 mb-6 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-gray-400 px-2">
            <ArrowDownWideNarrow className="w-4 h-4 text-red-500" />
            <span className="hidden sm:inline text-xs font-semibold uppercase tracking-wider">Sort by</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {sorts.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                className={`inline-flex items-center gap-1.5 min-h-[36px] rounded-md px-3 text-xs font-semibold transition-all focus-ring ${
                  sort === s.key
                    ? "bg-white text-black"
                    : "text-gray-300 hover:bg-white/10 hover:text-white"
                }`}
                aria-pressed={sort === s.key}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-md skeleton-shimmer" />
            ))}
          </div>
        )}

        {isError && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-center glass-soft rounded-2xl max-w-md mx-auto">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-gray-300 mb-4">{tn("tryAgain")}</p>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center justify-center min-h-[40px] rounded-md px-5 bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors focus-ring"
            >
              {t("retry")}
            </button>
          </div>
        )}

        {!isLoading && !isError && sortedMovies.length > 0 && (
          <Reveal as="div" className="stagger grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 content-auto">
            {sortedMovies.map((movie, idx) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                index={idx}
                comingSoon={category === "coming-soon" || category === "upcoming"}
              />
            ))}
          </Reveal>
        )}

        {!isLoading && !isError && sortedMovies.length === 0 && (
          <div className="text-center py-20">
            <div className="glass-soft rounded-2xl p-10 max-w-md mx-auto">
              <Sparkles className="w-10 h-10 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-300">{t("empty")}</p>
            </div>
          </div>
        )}
      </PageContainer>
    </div>
  );
};

export default Browse;
