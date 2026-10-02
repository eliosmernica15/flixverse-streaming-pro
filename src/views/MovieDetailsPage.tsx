"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { notFound, useParams, useSearchParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { MovieDetailSkeleton } from "@/components/skeletons/RouteSkeletons";

const MovieDetails = dynamic(() => import("@/components/MovieDetails"), {
  ssr: false,
  loading: () => <MovieDetailSkeleton />,
});

const MovieDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const movieId = id ? parseInt(Array.isArray(id) ? id[0] : id) : 0;
  const mediaType = (searchParams.get("type") as "movie" | "tv") || "movie";
  const season = searchParams.get("season") ? parseInt(searchParams.get("season")!) : undefined;
  const episode = searchParams.get("episode") ? parseInt(searchParams.get("episode")!) : undefined;
  const partyId = searchParams.get("party");
  const autoplay =
    searchParams.get("autoplay") === "true" ||
    (!!partyId && searchParams.get("autoplay") !== "false");
  const resumePosition = searchParams.get("resume") ? parseInt(searchParams.get("resume")!) : undefined;
  const initialServer = searchParams.get("server") ? parseInt(searchParams.get("server")!) : undefined;
  const { toast } = useToast();
  const autoplayTriggered = useRef(false);

  useEffect(() => {
    if (autoplay && !autoplayTriggered.current) {
      autoplayTriggered.current = true;
      if (resumePosition && resumePosition > 60) {
        const minutes = Math.floor(resumePosition / 60);
        toast({
          title: "Resuming playback",
          description: `Continuing from ${minutes} minute${minutes > 1 ? "s" : ""} in`,
        });
      }
    }
  }, [autoplay, resumePosition, toast]);

  if (!movieId || Number.isNaN(movieId) || movieId <= 0) {
    notFound();
  }

  return (
    <MovieDetails
      movieId={movieId}
      mediaType={mediaType}
      onClose={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push(mediaType === "tv" ? "/tv-shows" : "/movies");
        }
      }}
      autoplay={autoplay}
      resumePosition={resumePosition}
      initialSeason={season}
      initialEpisode={episode}
      initialServer={initialServer}
    />
  );
};

export default MovieDetailsPage;
