import { Suspense } from "react";
import { SearchPageSkeleton } from "@/components/skeletons/RouteSkeletons";
import { LazySearchResults } from "@/lib/lazy-views";

export default function SearchPage() {
    return (
        <Suspense fallback={<SearchPageSkeleton />}>
            <LazySearchResults />
        </Suspense>
    );
}
