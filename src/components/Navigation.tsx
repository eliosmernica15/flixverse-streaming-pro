
import { useState, useEffect } from "react";
import { Bell, User, LogOut, Menu, X, Sparkles, ChevronDown } from "lucide-react";
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
import { motion, AnimatePresence } from "framer-motion";

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
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
          isScrolled 
            ? 'glass-premium shadow-2xl shadow-black/40' 
            : 'bg-gradient-to-b from-black/90 via-black/50 to-transparent'
        }`}
      >
        {/* Animated border glow when scrolled */}
        <div className={`absolute bottom-0 left-0 right-0 h-[1px] transition-opacity duration-500 ${
          isScrolled ? 'opacity-100' : 'opacity-0'
        }`}>
          <div className="h-full bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
        </div>

        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <motion.div 
              className="flex items-center"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <Link to="/" className="flex-shrink-0 group">
                <div className="flex items-center space-x-2.5">
                  <div className="relative">
                    <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-red-500 group-hover:text-red-400 transition-all duration-300 group-hover:rotate-12" />
                    <div className="absolute inset-0 blur-xl bg-red-500/40 group-hover:bg-red-400/50 transition-colors animate-pulse-glow" />
                  </div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight">
                    <span className="text-gradient-primary">Flix</span>
                    <span className="text-white">Verse</span>
                  </h1>
                </div>
              </Link>
            </motion.div>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center space-x-1 lg:space-x-2">
              {navLinks.map((link, index) => (
                <motion.div
                  key={link.path}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 + 0.2 }}
                >
                  <Link 
                    to={link.path} 
                    className={`relative px-4 py-2.5 text-sm lg:text-base font-medium transition-all duration-300 rounded-xl group ${
                      isActive(link.path) 
                        ? 'text-white' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {/* Background hover effect */}
                    <span className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                      isActive(link.path)
                        ? 'bg-white/10 backdrop-blur-sm'
                        : 'bg-transparent group-hover:bg-white/5'
                    }`} />
                    
                    {/* Label */}
                    <span className="relative z-10">{link.label}</span>
                    
                    {/* Active indicator */}
                    {isActive(link.path) && (
                      <motion.span 
                        layoutId="activeNav"
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-1 bg-gradient-to-r from-red-500 to-orange-500 rounded-full"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* Right Side Icons */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Search Bar */}
              <motion.div 
                className="hidden sm:block"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
              >
                <SearchBar onMovieSelect={handleMovieSelect} />
              </motion.div>

              {/* Notification Settings */}
              <NotificationSettings />
              
              {/* Real-time Notifications */}
              <NotificationBell />

              {/* Profile */}
              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <motion.button 
                      className="flex items-center space-x-2 hover:bg-white/10 rounded-xl px-2 sm:px-3 py-2 transition-all duration-300 group"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="relative">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-red-500 via-red-600 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/25 group-hover:shadow-red-500/40 transition-shadow">
                          <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />
                      </div>
                      <div className="hidden lg:flex items-center space-x-1">
                        <span className="text-sm font-medium text-white">
                          {profile?.display_name || user?.email?.split('@')[0]}
                        </span>
                        <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                      </div>
                    </motion.button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end" 
                    className="w-60 glass-premium rounded-2xl p-2 border-white/10 mt-2"
                  >
                    {/* User info header */}
                    <div className="px-3 py-3 mb-2 bg-white/5 rounded-xl">
                      <p className="text-sm font-semibold text-white truncate">
                        {profile?.display_name || user?.email?.split('@')[0]}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                    </div>
                    
                    <DropdownMenuItem 
                      onClick={() => navigate('/profile')}
                      className="text-gray-300 hover:text-white hover:bg-white/10 rounded-xl cursor-pointer py-3"
                    >
                      <User className="w-4 h-4 mr-3" />
                      My Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => navigate('/my-list')}
                      className="text-gray-300 hover:text-white hover:bg-white/10 rounded-xl cursor-pointer py-3"
                    >
                      <Sparkles className="w-4 h-4 mr-3" />
                      My Watchlist
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/10 my-2" />
                    <DropdownMenuItem 
                      onClick={handleSignOut}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl cursor-pointer py-3"
                    >
                      <LogOut className="w-4 h-4 mr-3" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <Link to="/auth">
                    <Button className="relative overflow-hidden bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transition-all duration-300 hover:scale-105 btn-shine">
                      Sign In
                    </Button>
                  </Link>
                </motion.div>
              )}

              {/* Mobile Menu Button */}
              <motion.button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2.5 hover:bg-white/10 rounded-xl transition-all duration-300"
                whileTap={{ scale: 0.9 }}
              >
                <AnimatePresence mode="wait">
                  {isMobileMenuOpen ? (
                    <motion.div
                      key="close"
                      initial={{ rotate: -90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: 90, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <X className="w-5 h-5 text-white" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="menu"
                      initial={{ rotate: 90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: -90, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Menu className="w-5 h-5 text-white" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          </div>

          {/* Mobile Menu */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="md:hidden overflow-hidden"
              >
                <div className="py-4 space-y-2 border-t border-white/10">
                  {/* Mobile Search */}
                  <div className="px-2 py-2">
                    <SearchBar onMovieSelect={handleMovieSelect} />
                  </div>
                  
                  {/* Mobile Navigation Links */}
                  {navLinks.map((link, index) => (
                    <motion.div
                      key={link.path}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link
                        to={link.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`block px-4 py-3.5 rounded-xl text-base font-medium transition-all duration-300 ${
                          isActive(link.path) 
                            ? 'text-white bg-gradient-to-r from-red-500/20 to-orange-500/10 border-l-2 border-red-500' 
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {link.label}
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.nav>

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
