
import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import MovieDetails from "@/components/MovieDetails";
import { useToast } from "@/hooks/use-toast";

const MovieDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const movieId = id ? parseInt(id) : 0;
  const mediaType = searchParams.get('type') as "movie" | "tv" || "movie";
  const autoplay = searchParams.get('autoplay') === 'true';
  const { toast } = useToast();

  useEffect(() => {
    if (autoplay) {
      toast({
        title: "Auto-playing content",
        description: "Starting playback automatically...",
      });
    }
  }, [autoplay, toast]);

  const handleClose = () => {
    window.close();
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
    />
  );
};

export default MovieDetailsPage;
