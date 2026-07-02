import { Suspense } from "react";
import { LazyMovieDetailsPage } from "@/lib/lazy-views";

export default function MoviePage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black" />}>
            <LazyMovieDetailsPage />
        </Suspense>
    );
}
