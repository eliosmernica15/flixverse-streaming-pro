import { Suspense } from 'react';
import SearchResults from '@/views/SearchResults';

export default function SearchPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black" />}>
            <SearchResults />
        </Suspense>
    );
}
