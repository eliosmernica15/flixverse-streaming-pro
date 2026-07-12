"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, MapPin, User as UserIcon } from "lucide-react";
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

async function fetchPersonCredits(id: number) {
  const res = await fetch(`/api/tmdb/person/${id}/combined_credits`);
  if (!res.ok) throw new Error("Failed to fetch credits");
  return res.json();
}

export default function PersonDetails({ personId }: PersonDetailsProps) {
  const router = useRouter();
  const locale = useLocale();
  const [showFullBio, setShowFullBio] = useState(false);

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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center glass-panel rounded-3xl p-10 max-w-md w-full">
          <p className="text-white text-lg font-semibold mb-2">Person not found</p>
          <button
            onClick={() => router.back()}
            className="btn-primary min-h-[44px] px-6 py-3 focus-ring"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const profileUrl = person.profile_path ? getImageUrl(person.profile_path, "large") : null;
  const knownFor = (credits?.cast || [])
    .sort((a: TMDBMovie, b: TMDBMovie) => (b.vote_average || 0) - (a.vote_average || 0))
    .slice(0, 12);
  const crewCredits = (credits?.crew || [])
    .filter((c: TMDBMovie & { department?: string }, i: number, arr: TMDBMovie[]) =>
      arr.findIndex((x) => x.id === c.id) === i
    )
    .sort((a: TMDBMovie, b: TMDBMovie) => (b.vote_average || 0) - (a.vote_average || 0))
    .slice(0, 12);

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors focus-ring min-w-[44px] min-h-[44px]"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-white font-bold truncate">{person.name}</h1>
        </div>
      </div>

      {/* Hero */}
      <div className="pt-16">
        <div className="relative h-[50vh] min-h-[400px] overflow-hidden">
          {profileUrl ? (
            <Image
              src={profileUrl}
              alt={person.name}
              fill
              className="object-cover object-top"
              sizes="100vw"
              priority
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-black" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent" />

          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-end gap-5">
                <div className="relative shrink-0 -mb-2 hidden sm:block">
                  <div className="w-28 h-28 rounded-2xl overflow-hidden border-2 border-white/10 glow-ring">
                    {profileUrl ? (
                      <Image
                        src={profileUrl}
                        alt={person.name}
                        width={112}
                        height={112}
                        className="object-cover w-full h-full"
                        sizes="112px"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-red-500/30 to-purple-500/30 flex items-center justify-center">
                        <UserIcon className="w-10 h-10 text-white/80" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="min-w-0">
                  <h1 className="display-title text-3xl sm:text-5xl font-black text-white mb-3 text-balance">
                    {person.name}
                  </h1>

                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {person.known_for_department && (
                      <span className="chip">{person.known_for_department}</span>
                    )}
                    {person.birthday && (
                      <span className="chip">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(person.birthday).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    )}
                    {person.place_of_birth && (
                      <span className="chip">
                        <MapPin className="w-3.5 h-3.5" />
                        {person.place_of_birth}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Biography */}
        {person.biography && (
          <Reveal className="mb-12">
            <div className="glass-panel rounded-2xl p-6 sm:p-8">
              <SectionHeader title="Biography" eyebrow="About" />
              <p className={`text-gray-300 text-sm leading-relaxed whitespace-pre-line mt-4 ${
                !showFullBio ? "line-clamp-4" : ""
              }`}>
                {person.biography}
              </p>
              {person.biography.length > 300 && (
                <button
                  onClick={() => setShowFullBio(!showFullBio)}
                  className="text-red-400 text-sm mt-3 font-medium hover:underline focus-ring rounded"
                >
                  {showFullBio ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          </Reveal>
        )}

        <div className="divider-glow mb-10" />

        {/* Known For */}
        {knownFor.length > 0 && (
          <Reveal className="mb-12">
            <SectionHeader title="Known For" eyebrow="Filmography" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-4 content-auto">
              {knownFor.map((movie: TMDBMovie) => (
                <div key={movie.id} className="hover-lift-sm rounded-2xl">
                  <MovieCard movie={movie} />
                </div>
              ))}
            </div>
          </Reveal>
        )}

        <div className="divider-glow mb-10" />

        {/* Crew */}
        {crewCredits.length > 0 && (
          <Reveal className="mb-12">
            <SectionHeader title="Crew" eyebrow="Behind the scenes" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-4 content-auto">
              {crewCredits.map((movie: TMDBMovie) => (
                <div key={movie.id} className="hover-lift-sm rounded-2xl">
                  <MovieCard movie={movie} />
                </div>
              ))}
            </div>
          </Reveal>
        )}
      </div>
    </div>
  );
}
