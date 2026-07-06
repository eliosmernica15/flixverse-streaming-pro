"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getImageUrl, TMDBMovie } from "@/utils/tmdbApi";

interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

interface CastCrewGridProps {
  cast: CastMember[];
  crew: CrewMember[];
  maxVisible?: number;
}

export function CastCrewGrid({ cast, crew, maxVisible = 10 }: CastCrewGridProps) {
  const [showAll, setShowAll] = useState(false);
  const router = useRouter();

  const visibleCast = showAll ? cast : cast.slice(0, maxVisible);
  const uniqueCrew = crew
    .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i)
    .slice(0, 12);

  if (cast.length === 0 && crew.length === 0) return null;

  const handlePersonClick = (id: number) => {
    router.push(`/person/${id}`);
  };

  return (
    <div className="space-y-8">
      {/* Cast */}
      {cast.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Cast</h3>
            {cast.length > maxVisible && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                {showAll ? "Show less" : `Show all (${cast.length})`}
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {visibleCast.map((person) => (
              <button
                key={`${person.id}-${person.order}`}
                onClick={() => handlePersonClick(person.id)}
                className="group flex flex-col items-center p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all hover:scale-105"
              >
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden mb-2">
                  {person.profile_path ? (
                    <Image
                      src={getImageUrl(person.profile_path, "small")}
                      alt={person.name}
                      fill
                      className="object-cover"
                      sizes="80px"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                      <span className="text-lg font-bold text-gray-500">
                        {person.name.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-xs font-semibold text-white text-center line-clamp-1">
                  {person.name}
                </p>
                <p className="text-[10px] text-gray-500 text-center line-clamp-1 mt-0.5">
                  {person.character}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Crew */}
      {uniqueCrew.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-white mb-4">Crew</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {uniqueCrew.map((person) => (
              <button
                key={person.id}
                onClick={() => handlePersonClick(person.id)}
                className="group flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-left"
              >
                <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0">
                  {person.profile_path ? (
                    <Image
                      src={getImageUrl(person.profile_path, "small")}
                      alt={person.name}
                      fill
                      className="object-cover"
                      sizes="40px"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                      <span className="text-sm font-bold text-gray-500">
                        {person.name.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{person.name}</p>
                  <p className="text-[10px] text-gray-500 truncate">{person.job}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
