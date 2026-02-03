"use client";


import { useEffect, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import MovieDetails from "@/components/MovieDetails";
import { useToast } from "@/hooks/use-toast";

const MovieDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const movieId = id ? parseInt(Array.isArray(id) ? id[0] : id) : 0;
  const mediaType = searchParams.get('type') as "movie" | "tv" || "movie";
  const autoplay = searchParams.get('autoplay') === 'true';
  const resumePosition = searchParams.get('resume') ? parseInt(searchParams.get('resume')!) : undefined;
  const season = searchParams.get('season') ? parseInt(searchParams.get('season')!) : undefined;
  const episode = searchParams.get('episode') ? parseInt(searchParams.get('episode')!) : undefined;
  const { toast } = useToast();
  const autoplayTriggered = useRef(false);

  useEffect(() => {
    if (autoplay && !autoplayTriggered.current) {
      autoplayTriggered.current = true;
      if (resumePosition && resumePosition > 60) {
        const minutes = Math.floor(resumePosition / 60);
        toast({
          title: "Resuming playback",
          description: `Continuing from ${minutes} minute${minutes > 1 ? 's' : ''} in`,
        });
      } else {
        toast({
          title: "Auto-playing content",
          description: "Starting playback automatically...",
        });
      }
    }
  }, [autoplay, resumePosition, toast]);

  const handleClose = () => {
    // Always navigate to home page for reliable behavior
    // This ensures the back button works even when navigating directly to the page
    router.push('/');
  };

  if (!movieId) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-2xl">Movie not found</div>
      </div>
    );
  }

  return (
    <MovieDetails
      movieId={movieId}
      mediaType={mediaType}
      onClose={handleClose}
      autoplay={autoplay}
      resumePosition={resumePosition}
      initialSeason={season}
      initialEpisode={episode}
    />
  );
};

export default MovieDetailsPage;
