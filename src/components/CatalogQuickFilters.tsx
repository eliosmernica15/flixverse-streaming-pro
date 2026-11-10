"use client";

import type { CatalogFilters, CatalogYearRange } from "@/lib/catalogFilters";

export interface CatalogGenreOption {
  id: number;
  label: string;
}

interface CatalogQuickFiltersProps {
  filters: CatalogFilters;
  genres: CatalogGenreOption[];
  onChange: (filters: CatalogFilters) => void;
}

const YEAR_RANGES: { value: CatalogYearRange; label: string }[] = [
  { value: "all", label: "Any year" },
  { value: "2020s", label: "2020-now" },
  { value: "2010s", label: "2010s" },
  { value: "2000s", label: "2000s" },
  { value: "before-2000", label: "Before 2000" },
];

export default function CatalogQuickFilters({
  filters,
  genres,
  onChange,
}: CatalogQuickFiltersProps) {
  return (
    <div className="mb-8 flex flex-wrap items-end gap-3" aria-label="Catalog filters">
      <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
        Release decade
        <select
          value={filters.yearRange}
          onChange={(event) =>
            onChange({ ...filters, yearRange: event.target.value as CatalogYearRange })
          }
          className="min-h-10 rounded-lg border border-white/10 bg-zinc-900 px-3 text-xs font-medium normal-case tracking-normal text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          {YEAR_RANGES.map((range) => (
            <option key={range.value} value={range.value}>{range.label}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
        Genre
        <select
          value={filters.genreId ?? ""}
          onChange={(event) =>
            onChange({
              ...filters,
              genreId: event.target.value ? Number(event.target.value) : null,
            })
          }
          className="min-h-10 rounded-lg border border-white/10 bg-zinc-900 px-3 text-xs font-medium normal-case tracking-normal text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          <option value="">All genres</option>
          {genres.map((genre) => (
            <option key={genre.id} value={genre.id}>{genre.label}</option>
          ))}
        </select>
      </label>
      {(filters.yearRange !== "all" || filters.genreId !== null) && (
        <button
          type="button"
          onClick={() => onChange({ yearRange: "all", genreId: null })}
          className="min-h-10 rounded-lg px-3 text-xs font-semibold text-gray-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
