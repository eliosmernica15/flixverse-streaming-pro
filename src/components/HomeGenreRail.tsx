"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { BROWSE_MEGA_MENU } from "@/utils/browseCategories";

const HOME_GENRES = [
  "action",
  "comedy",
  "horror",
  "sci-fi",
  "animation",
  "fantasy",
  "thriller",
  "romance",
  "crime-mystery",
  "documentaries",
] as const;

export default function HomeGenreRail() {
  const t = useTranslations("carousel");
  const browse = useTranslations("browse");

  return (
    <nav aria-label={t("genreRail")} className="min-w-0">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-gray-400">
        {t("genreRail")}
      </h2>
      <ul className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {HOME_GENRES.filter((slug) =>
          BROWSE_MEGA_MENU.some((group) => group.links.some((link) => link.slug === slug))
        ).map((slug) => (
          <li key={slug} className="shrink-0">
            <Link
              href={`/browse/${slug}`}
              className="inline-flex min-h-10 items-center rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-gray-200 transition-colors hover:border-red-400/40 hover:bg-red-500/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              {browse(slug)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
