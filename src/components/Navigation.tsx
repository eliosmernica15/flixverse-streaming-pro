
import { useState, useEffect } from "react";
import { Bell, User, LogOut, Menu, X, Sparkles } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import SearchBar from "./SearchBar";
import NotificationSettings from "./NotificationSettings";
import NotificationBell from "./NotificationBell";
import { TMDBMovie } from "@/utils/tmdbApi";
import MovieDetails from "./MovieDetails";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";

const Navigation = () => {
  const [selectedMovie, setSelectedMovie] = useState<TMDBMovie | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, signOut } = useAuth();
  const { profile } = useUserProfile();
  const { toast } = useToast();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleMovieSelect = (movie: TMDBMovie) => {
    setSelectedMovie(movie);
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed out successfully",
        description: "You have been signed out of your account",
      });
      navigate('/');
    } catch (error) {
      toast({
        title: "Error signing out",
        description: "There was an error signing out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/tv-shows', label: 'TV Shows' },
    { path: '/movies', label: 'Movies' },
    { path: '/new-and-popular', label: 'New & Popular' },
    { path: '/my-list', label: 'My List' },
  ];

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled 
          ? 'bg-black/95 backdrop-blur-xl shadow-2xl shadow-black/50' 
          : 'bg-gradient-to-b from-black/80 via-black/40 to-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex-shrink-0 group">
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-red-500 group-hover:text-red-400 transition-colors" />
                    <div className="absolute inset-0 blur-lg bg-red-500/30 group-hover:bg-red-400/40 transition-colors" />
                  </div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight">
                    <span className="text-gradient-primary">Flix</span>
                    <span className="text-white">Verse</span>
                  </h1>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center space-x-1 lg:space-x-2">
              {navLinks.map((link) => (
                <Link 
                  key={link.path}
                  to={link.path} 
                  className={`relative px-4 py-2 text-sm lg:text-base font-medium transition-all duration-300 rounded-full ${
                    isActive(link.path) 
                      ? 'text-white bg-white/10' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {link.label}
                  {isActive(link.path) && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full" />
                  )}
                </Link>
              ))}
            </div>

            {/* Right Side Icons */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Search Bar */}
              <div className="hidden sm:block">
                <SearchBar onMovieSelect={handleMovieSelect} />
              </div>

              {/* Notification Settings */}
              <NotificationSettings />
              
              {/* Real-time Notifications */}
              <NotificationBell />

              {/* Profile */}
              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center space-x-2 hover:bg-white/10 rounded-full px-2 sm:px-3 py-2 transition-all duration-300">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/20">
                        <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <span className="hidden lg:block text-sm font-medium text-white">
                        {profile?.display_name || user?.email?.split('@')[0]}
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-black/95 backdrop-blur-xl border-white/10 rounded-xl p-2">
                    <DropdownMenuItem 
                      onClick={() => navigate('/profile')}
                      className="text-gray-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
                    >
                      <User className="w-4 h-4 mr-2" />
                      My Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => navigate('/my-list')}
                      className="text-gray-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
                    >
                      My Watchlist
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/10 my-2" />
                    <DropdownMenuItem 
                      onClick={handleSignOut}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link to="/auth">
                  <Button className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white text-sm font-semibold px-4 py-2 rounded-full shadow-lg shadow-red-500/20 hover:shadow-red-500/30 transition-all duration-300 hover:scale-105">
                    Sign In
                  </Button>
                </Link>
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 hover:bg-white/10 rounded-full transition-all duration-300"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5 text-white" />
                ) : (
                  <Menu className="w-5 h-5 text-white" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          <div className={`md:hidden overflow-hidden transition-all duration-300 ${
            isMobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}>
            <div className="py-4 space-y-2 border-t border-white/10">
              {/* Mobile Search */}
              <div className="px-2 py-2">
                <SearchBar onMovieSelect={handleMovieSelect} />
              </div>
              
              {/* Mobile Navigation Links */}
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block px-4 py-3 rounded-xl text-base font-medium transition-all duration-300 ${
                    isActive(link.path) 
                      ? 'text-white bg-white/10' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Search Results Modal */}
      {selectedMovie && (
        <MovieDetails 
          movieId={selectedMovie.id}
          mediaType={selectedMovie.media_type === 'tv' ? 'tv' : 'movie'}
          onClose={() => setSelectedMovie(null)}
        />
      )}
    </>
  );
};

export default Navigation;
