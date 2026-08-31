"use client";

import { useState, useMemo } from "react";
import { Calendar, MapPin, User as UserIcon, Film, Tv, Sparkles, Briefcase } from "lucide-react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { getImageUrl, TMDBMovie, fetchPersonDetails as fetchPersonFromTmdb } from "@/utils/tmdbApi";
import { localeQueryKey } from "@/i18n/config";
import { useLocale } from "@/hooks/useLocale";
import MovieCard from "@/components/MovieCard";
import SectionHeader from "@/components/SectionHeader";
import Reveal from "@/components/Reveal";

interface PersonDetailsProps {
  personId: number;
}

type TabType = "all" | "movie" | "tv" | "crew";

async function fetchPersonCredits(id: number) {
  const res = await fetch(`/api/tmdb/person/${id}/combined_credits`);
  if (!res.ok) throw new Error("Failed to fetch credits");
  return res.json();
}

export default function PersonDetails({ personId }: PersonDetailsProps) {
  const locale = useLocale();
  const [showFullBio, setShowFullBio] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("all");

  const { data: person, isLoading: loadingPerson } = useQuery({
    queryKey: localeQueryKey(["person", personId], locale),
    queryFn: () => fetchPersonFromTmdb(personId),
    staleTime: 1000 * 60 * 60,
  });

  const { data: credits, isLoading: loadingCredits } = useQuery({
    queryKey: localeQueryKey(["person-credits", personId], locale),
    queryFn: () => fetchPersonCredits(personId),
    staleTime: 1000 * 60 * 60,
  });

  const castMovies = useMemo(() => {
    const rawCast = (credits?.cast || []) as TMDBMovie[];
    const seen = new Set<number>();
    return rawCast
      .filter((m) => {
        if (!m || !m.id || seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      })
      .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
  }, [credits]);

  const crewMovies = useMemo(() => {
    const rawCrew = (credits?.crew || []) as (TMDBMovie & { department?: string })[];
    const seen = new Set<number>();
    return rawCrew
      .filter((c) => {
        if (!c || !c.id || seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      })
      .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
  }, [credits]);

  const displayedList = useMemo(() => {
    if (activeTab === "crew") return crewMovies;
    if (activeTab === "movie") return castMovies.filter((m) => m.media_type === "movie");
    if (activeTab === "tv") return castMovies.filter((m) => m.media_type === "tv");
    return castMovies;
  }, [activeTab, castMovies, crewMovies]);

  if (loadingPerson || loadingCredits) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading person details…</p>
        </div>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center glass-soft rounded-2xl p-10 max-w-md w-full">
          <p className="text-white text-lg font-semibold mb-2">Person not found</p>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-red-600 hover:bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors focus-ring"
          >
            Go home
          </a>
        </div>
      </div>
    );
  }

  const profileUrl = person.profile_path ? getImageUrl(person.profile_path, "large") : null;
  const movieCount = castMovies.filter((m) => m.media_type === "movie").length;
  const tvCount = castMovies.filter((m) => m.media_type === "tv").length;

  return (
    <div className="min-h-screen bg-black">
      {/* Hero */}
      <div className="relative h-[55vh] min-h-[440px] overflow-hidden">
        {profileUrl ? (
          <Image
            src={profileUrl}
            alt={person.name}
            fill
            className="object-cover object-top scale-110 blur-[2px] opacity-40"
            sizes="100vw"
            priority
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 to-black/20" />

        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10 lg:p-12">
          <div className="max-w-[1800px] mx-auto">
            <div className="flex items-end gap-5 sm:gap-7">
              <div className="relative shrink-0 -mb-2 hidden sm:block">
                <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-xl overflow-hidden ring-2 ring-white/20 shadow-2xl shadow-black/60">
                  {profileUrl ? (
                    <Image
                      src={profileUrl}
                      alt={person.name}
                      width={144}
                      height={144}
                      className="object-cover w-full h-full"
                      sizes="144px"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-red-500/30 to-purple-500/30 flex items-center justify-center">
                      <UserIcon className="w-12 h-12 text-white/80" />
                    </div>
                  )}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-red-500 mb-1.5">
                  {person.known_for_department || "Talent"}
                </span>
                <h1 className="hero-text-shadow-strong text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white mb-3 text-balance leading-[1.05]">
                  {person.name}
                </h1>
                <div className="flex flex-wrap items-center gap-2">
                  {person.birthday && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-gray-200">
                      <Calendar className="h-3 w-3" />
                      {new Date(person.birthday).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                  {person.place_of_birth && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-gray-200">
                      <MapPin className="h-3 w-3" />
                      {person.place_of_birth}
                    </span>
                  )}
                  {movieCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-red-500/25 bg-red-500/10 px-2.5 py-1 text-[11px] text-red-300">
                      <Film className="h-3 w-3" />
                      {movieCount} {movieCount === 1 ? "movie" : "movies"}
                    </span>
                  )}
                  {tvCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-purple-500/25 bg-purple-500/10 px-2.5 py-1 text-[11px] text-purple-300">
                      <Tv className="h-3 w-3" />
                      {tvCount} {tvCount === 1 ? "series" : "series"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-10 py-10">
        {/* Biography */}
        {person.biography && (
          <Reveal className="mb-12">
            <div className="glass-soft rounded-2xl p-6 sm:p-8">
              <SectionHeader title="Biography" eyebrow="About" />
              <p className={`text-gray-300 text-sm sm:text-base leading-relaxed whitespace-pre-line mt-4 ${
                !showFullBio ? "line-clamp-4" : ""
              }`}>
                {person.biography}
              </p>
              {person.biography.length > 300 && (
                <button
                  onClick={() => setShowFullBio(!showFullBio)}
                  className="text-red-400 text-sm mt-3 font-semibold hover:text-red-300 focus-ring rounded"
                >
                  {showFullBio ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          </Reveal>
        )}

        <div className="divider-glow mb-10" />

        {/* Filmography with filter tabs */}
        <Reveal className="mb-12">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <SectionHeader title="Filmography" eyebrow={`${displayedList.length} titles`} />
            <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-black/30 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeTab === "all"
                    ? "bg-white text-black"
                    : "text-gray-300 hover:text-white"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                All
                <span className={`text-[10px] ${activeTab === "all" ? "text-black/60" : "text-gray-500"}`}>
                  {castMovies.length}
                </span>
              </button>
              {movieCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("movie")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeTab === "movie"
                      ? "bg-white text-black"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  <Film className="h-3.5 w-3.5" />
                  Movies
                  <span className={`text-[10px] ${activeTab === "movie" ? "text-black/60" : "text-gray-500"}`}>
                    {movieCount}
                  </span>
                </button>
              )}
              {tvCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("tv")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeTab === "tv"
                      ? "bg-white text-black"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  <Tv className="h-3.5 w-3.5" />
                  TV
                  <span className={`text-[10px] ${activeTab === "tv" ? "text-black/60" : "text-gray-500"}`}>
                    {tvCount}
                  </span>
                </button>
              )}
              {crewMovies.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("crew")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeTab === "crew"
                      ? "bg-white text-black"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  Crew
                  <span className={`text-[10px] ${activeTab === "crew" ? "text-black/60" : "text-gray-500"}`}>
                    {crewMovies.length}
                  </span>
                </button>
              )}
            </div>
          </div>

          {displayedList.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 content-auto">
              {displayedList.map((movie: TMDBMovie, idx: number) => (
                <MovieCard
                  key={`${movie.id}-${movie.media_type || "credit"}-${idx}`}
                  movie={movie}
                  index={idx}
                  priority={idx < 6}
                />
              ))}
            </div>
          ) : (
            <div className="glass-soft p-10 rounded-2xl text-center text-gray-400 text-sm">
              No credits in this category.
            </div>
          )}
        </Reveal>
      </div>
    </div>
  );
}
