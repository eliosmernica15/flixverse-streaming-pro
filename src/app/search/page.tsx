import { Suspense } from "react";
import { LazySearchResults } from "@/lib/lazy-views";

export default function SearchPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black" />}>
            <LazySearchResults />
        </Suspense>
    );
}
