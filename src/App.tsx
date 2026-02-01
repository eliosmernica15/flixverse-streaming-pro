
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import PageTransition from "@/components/PageTransition";
import Index from "./pages/Index";
import TVShows from "./pages/TVShows";
import Movies from "./pages/Movies";
import NewAndPopular from "./pages/NewAndPopular";
import MyList from "./pages/MyList";
import MovieDetailsPage from "./pages/MovieDetailsPage";
import SearchResults from "./pages/SearchResults";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";

const queryClient = new QueryClient();

// Animated Routes component that wraps routes with AnimatePresence
const AnimatedRoutes = () => {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Index /></PageTransition>} />
        <Route path="/auth" element={<PageTransition><Auth /></PageTransition>} />
        <Route path="/tv-shows" element={<PageTransition><TVShows /></PageTransition>} />
        <Route path="/movies" element={<PageTransition><Movies /></PageTransition>} />
        <Route path="/new-and-popular" element={<PageTransition><NewAndPopular /></PageTransition>} />
        <Route path="/my-list" element={<PageTransition><MyList /></PageTransition>} />
        <Route path="/profile" element={<PageTransition><Profile /></PageTransition>} />
        <Route path="/movie/:id" element={<PageTransition><MovieDetailsPage /></PageTransition>} />
        <Route path="/search" element={<PageTransition><SearchResults /></PageTransition>} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
