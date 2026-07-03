import dynamic from "next/dynamic";

export const LazyAuth = dynamic(() => import("@/views/Auth"));
export const LazyIndex = dynamic(() => import("@/views/Index"));
export const LazyMovies = dynamic(() => import("@/views/Movies"));
export const LazyTVShows = dynamic(() => import("@/views/TVShows"));
export const LazyMyList = dynamic(() => import("@/views/MyList"));
export const LazyNewAndPopular = dynamic(() => import("@/views/NewAndPopular"));
export const LazyBrowse = dynamic(() => import("@/views/Browse"));
export const LazyProfile = dynamic(() => import("@/views/Profile"));
export const LazySearchResults = dynamic(() => import("@/views/SearchResults"));
export const LazyMovieDetailsPage = dynamic(() => import("@/views/MovieDetailsPage"));
export const LazyOfflineLibrary = dynamic(() => import("@/views/OfflineLibrary"));
