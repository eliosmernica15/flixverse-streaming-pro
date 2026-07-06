"use client";

import { useState } from "react";
import { Filter, X, ChevronDown } from "lucide-react";

export interface SearchFilterState {
  mediaType: "all" | "movie" | "tv" | "person";
  year: string;
  sort: "relevance" | "rating_desc" | "rating_asc" | "date_desc" | "date_asc";
}

interface SearchFiltersProps {
  filters: SearchFilterState;
  onChange: (filters: SearchFilterState) => void;
  resultCount?: number;
}

const MEDIA_TYPES = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV Shows" },
  { value: "person", label: "People" },
] as const;

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "rating_desc", label: "Rating: High to Low" },
  { value: "rating_asc", label: "Rating: Low to High" },
  { value: "date_desc", label: "Newest First" },
  { value: "date_asc", label: "Oldest First" },
] as const;

const DECADES = [
  "2020s", "2010s", "2000s", "1990s", "1980s", "1970s", "Earlier",
];

export function SearchFilters({ filters, onChange, resultCount }: SearchFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters =
    filters.mediaType !== "all" || filters.year !== "" || filters.sort !== "relevance";

  const clearFilters = () => {
    onChange({ mediaType: "all", year: "", sort: "relevance" });
  };

  return (
    <div className="mb-6">
      {/* Filter toggle + chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
            isExpanded || hasActiveFilters
              ? "bg-white/10 border-white/20 text-white"
              : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          Filters
          <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
        </button>

        {/* Active filter chips */}
        {filters.mediaType !== "all" && (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-xs text-red-400">
            {MEDIA_TYPES.find((m) => m.value === filters.mediaType)?.label}
            <button onClick={() => onChange({ ...filters, mediaType: "all" })}>
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
        {filters.year && (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-xs text-blue-400">
            {filters.year}
            <button onClick={() => onChange({ ...filters, year: "" })}>
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
        {filters.sort !== "relevance" && (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-xs text-purple-400">
            {SORT_OPTIONS.find((s) => s.value === filters.sort)?.label}
            <button onClick={() => onChange({ ...filters, sort: "relevance" })}>
              <X className="w-3 h-3" />
            </button>
          </span>
        )}

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            Clear all
          </button>
        )}

        {resultCount !== undefined && !isExpanded && (
          <span className="text-xs text-gray-500 ml-auto">
            {resultCount} result{resultCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Expanded filter panel */}
      {isExpanded && (
        <div className="mt-3 p-4 rounded-xl bg-white/5 border border-white/10 animate-fade-in-up">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Media type */}
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">
                Type
              </label>
              <div className="flex flex-wrap gap-1.5">
                {MEDIA_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => onChange({ ...filters, mediaType: type.value })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      filters.mediaType === type.value
                        ? "bg-red-600 text-white"
                        : "bg-white/5 text-gray-400 hover:text-white"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Decade */}
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">
                Decade
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => onChange({ ...filters, year: "" })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    filters.year === ""
                      ? "bg-red-600 text-white"
                      : "bg-white/5 text-gray-400 hover:text-white"
                  }`}
                >
                  Any
                </button>
                {DECADES.map((decade) => {
                  const startYear = parseInt(decade);
                  const yearValue = isNaN(startYear) ? "1970" : String(startYear);
                  return (
                    <button
                      key={decade}
                      onClick={() => onChange({ ...filters, year: yearValue })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        filters.year === yearValue
                          ? "bg-red-600 text-white"
                          : "bg-white/5 text-gray-400 hover:text-white"
                      }`}
                    >
                      {decade}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sort */}
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">
                Sort by
              </label>
              <div className="flex flex-wrap gap-1.5">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => onChange({ ...filters, sort: option.value })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      filters.sort === option.value
                        ? "bg-red-600 text-white"
                        : "bg-white/5 text-gray-400 hover:text-white"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
