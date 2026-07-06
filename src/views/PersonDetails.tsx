"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, MapPin } from "lucide-react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { getImageUrl, getBackdropUrl, TMDBMovie, getContentType } from "@/utils/tmdbApi";
import MovieCard from "@/components/MovieCard";

interface PersonDetailsProps {
  personId: number;
}

async function fetchPersonDetails(id: number) {
  const res = await fetch(
    `https://api.themoviedb.org/3/person/${id}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&language=en-US`
  );
  if (!res.ok) throw new Error("Failed to fetch person");
  return res.json();
}

async function fetchPersonCredits(id: number) {
  const res = await fetch(
    `https://api.themoviedb.org/3/person/${id}/combined_credits?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&language=en-US`
  );
  if (!res.ok) throw new Error("Failed to fetch credits");
  return res.json();
}

export default function PersonDetails({ personId }: PersonDetailsProps) {
  const router = useRouter();
  const [showFullBio, setShowFullBio] = useState(false);

  const { data: person, isLoading: loadingPerson } = useQuery({
    queryKey: ["person", personId],
    queryFn: () => fetchPersonDetails(personId),
    staleTime: 1000 * 60 * 60,
  });

  const { data: credits, isLoading: loadingCredits } = useQuery({
    queryKey: ["person-credits", personId],
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
        <div className="text-center">
          <p className="text-white text-lg font-semibold mb-2">Person not found</p>
          <button onClick={() => router.back()} className="text-red-400 text-sm hover:underline">
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
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
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
              <h1 className="text-3xl sm:text-5xl font-black text-white mb-2">{person.name}</h1>

              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-300 mb-4">
                {person.known_for_department && (
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/10 text-xs font-medium">
                    {person.known_for_department}
                  </span>
                )}
                {person.birthday && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(person.birthday).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                )}
                {person.place_of_birth && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {person.place_of_birth}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Biography */}
        {person.biography && (
          <div className="mb-10">
            <h2 className="text-xl font-bold text-white mb-3">Biography</h2>
            <p className={`text-gray-300 text-sm leading-relaxed whitespace-pre-line ${
              !showFullBio ? "line-clamp-4" : ""
            }`}>
              {person.biography}
            </p>
            {person.biography.length > 300 && (
              <button
                onClick={() => setShowFullBio(!showFullBio)}
                className="text-red-400 text-sm mt-2 hover:underline"
              >
                {showFullBio ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        )}

        {/* Known For */}
        {knownFor.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-bold text-white mb-4">Known For</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {knownFor.map((movie: TMDBMovie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          </div>
        )}

        {/* Crew */}
        {crewCredits.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-bold text-white mb-4">Crew</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {crewCredits.map((movie: TMDBMovie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
