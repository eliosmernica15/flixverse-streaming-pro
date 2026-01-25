
import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import MovieDetails from "@/components/MovieDetails";
import { useToast } from "@/hooks/use-toast";

const MovieDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
    // Check if there's history to go back to, otherwise go home
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
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
