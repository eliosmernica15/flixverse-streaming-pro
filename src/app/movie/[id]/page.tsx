import { Suspense } from 'react';
import MovieDetailsPage from '@/views/MovieDetailsPage';

export default function MoviePage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black" />}>
            <MovieDetailsPage />
        </Suspense>
    );
}
