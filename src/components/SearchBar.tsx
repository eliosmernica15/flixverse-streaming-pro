
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, User, Film, Tv } from "lucide-react";
import { TMDBMovie, TMDBPerson, searchMulti, searchPeople, getContentImage } from "@/utils/tmdbApi";
import { useToast } from "@/hooks/use-toast";

interface SearchBarProps {
  onMovieSelect: (movie: TMDBMovie) => void;
}

interface SearchResult {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  profile_path?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
  known_for_department?: string;
  known_for?: TMDBMovie[];
}

const SearchBar = ({ onMovieSelect }: SearchBarProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const searchContent = async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        // Search for movies, TV shows, and people
        const [multiResults, peopleResults] = await Promise.all([
          searchMulti(query),
          searchPeople(query)
        ]);

        // Combine results and prioritize by relevance
        const combined = [
          ...multiResults.map(item => ({
            ...item,
            media_type: item.media_type || (item.title ? 'movie' : 'tv')
          })),
          ...peopleResults.map(person => ({
            ...person,
            media_type: 'person'
          }))
        ]
          .filter(item => {
            // Filter out items without essential information
            if (item.media_type === 'person') {
              return item.name && (item.profile_path || item.known_for_department);
            }
            return (item.title || item.name) && (item.poster_path || item.backdrop_path || item.vote_average > 0);
          })
          .sort((a, b) => {
            // Prioritize movies and TV shows over people
            if (a.media_type === 'person' && b.media_type !== 'person') return 1;
            if (b.media_type === 'person' && a.media_type !== 'person') return -1;

            // Then sort by vote average
            return (b.vote_average || 0) - (a.vote_average || 0);
          })
          .slice(0, 12);

        setResults(combined);
      } catch (error) {
        console.error('Search error:', error);
        toast({
          title: "Search Error",
          description: "Failed to search content. Please try again.",
          variant: "destructive"
        });
      }
      setLoading(false);
    };

    const debounceTimer = setTimeout(searchContent, 300);
    return () => clearTimeout(debounceTimer);
  }, [query, toast]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResultSelect = (result: SearchResult) => {
    if (result.media_type === 'person') {
      // Handle person selection - could show their filmography
      console.log('Selected person:', result.name);
      toast({
        title: "Person Selected",
        description: `Viewing ${result.name}'s profile`,
      });
    } else {
      // Handle movie/TV show selection
      onMovieSelect(result as TMDBMovie);
    }
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  const getResultImage = (result: SearchResult) => {
    return getContentImage(result, result.media_type === 'person' ? 'profile' : 'poster', 'small');
  };

  const getMediaTypeIcon = (mediaType: string) => {
    switch (mediaType) {
      case 'movie':
        return <Film className="w-3 h-3" />;
      case 'tv':
        return <Tv className="w-3 h-3" />;
      case 'person':
        return <User className="w-3 h-3" />;
      default:
        return <Film className="w-3 h-3" />;
    }
  };

  const getMediaTypeColor = (mediaType: string) => {
    switch (mediaType) {
      case 'movie':
        return 'bg-red-600';
      case 'tv':
        return 'bg-blue-600';
      case 'person':
        return 'bg-green-600';
      default:
        return 'bg-gray-600';
    }
  };

  return (
    <div ref={searchRef} className="relative max-w-md w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) {
              e.preventDefault();
              router.push(`/search?q=${encodeURIComponent(query.trim())}`);
              setQuery("");
              setResults([]);
              setIsOpen(false);
            }
          }}
          placeholder="Search movies, TV shows & people..."
          className="w-full pl-10 pr-10 py-2 bg-black/60 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-500 focus:bg-black/80 transition-all"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && (query.length >= 2 || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-black/95 backdrop-blur-md border border-white/20 rounded-lg max-h-96 overflow-y-auto z-50">
          {loading && (
            <div className="p-4 text-center text-gray-400">
              <div className="animate-pulse">Searching...</div>
            </div>
          )}

          {!loading && results.length === 0 && query.length >= 2 && (
            <div className="p-4 text-center text-gray-400">
              No content found for "{query}"
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="py-2">
              {results.map((result) => (
                <button
                  key={`${result.id}-${result.media_type}`}
                  onClick={() => handleResultSelect(result)}
                  className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-white/10 transition-colors text-left"
                >
                  <div className="relative">
                    <img
                      src={getResultImage(result)}
                      alt={result.title || result.name}
                      loading="lazy"
                      className={`${result.media_type === 'person' ? 'w-12 h-12 rounded-full' : 'w-12 h-16 rounded'} object-cover shadow-lg`}
                      onError={(e) => {
                        e.currentTarget.src = getResultImage(result);
                      }}
                    />
                    <div className={`absolute -top-1 -right-1 ${getMediaTypeColor(result.media_type || 'movie')} text-white text-xs px-1 rounded flex items-center space-x-1`}>
                      {getMediaTypeIcon(result.media_type || 'movie')}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-medium truncate">
                      {result.title || result.name}
                    </h4>
                    <div className="flex items-center space-x-2 text-gray-400 text-sm">
                      {result.media_type === 'person' ? (
                        <span>{result.known_for_department || 'Actor'}</span>
                      ) : (
                        <>
                          <span>
                            {result.release_date || result.first_air_date
                              ? new Date(result.release_date || result.first_air_date).getFullYear()
                              : 'N/A'}
                          </span>
                          {result.vote_average && result.vote_average > 0 && (
                            <>
                              <span>•</span>
                              <div className="flex items-center space-x-1 text-yellow-400">
                                <span>⭐</span>
                                <span>{result.vote_average.toFixed(1)}</span>
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                    {result.media_type === 'person' && result.known_for && result.known_for.length > 0 && (
                      <p className="text-gray-500 text-xs truncate">
                        Known for: {result.known_for.map(item => item.title || item.name).slice(0, 2).join(', ')}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
