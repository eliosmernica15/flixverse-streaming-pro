"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { BROWSE_MEGA_MENU } from "@/utils/browseCategories";
import { useRoutePrefetch } from "@/hooks/useRoutePrefetch";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";

const COLUMN_LABEL: Record<(typeof BROWSE_MEGA_MENU)[number]["id"], string> = {
  movies: "browseMovies",
  tv: "browseTv",
  collections: "browseCollections",
  moods: "browseMoods",
};

export function BrowseMegaMenu() {
  const t = useTranslations("nav");
  const prefetchRoute = useRoutePrefetch();

  return (
    <NavigationMenu className="relative z-[60] hidden lg:flex">
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger className="h-11 min-h-[44px] rounded-xl bg-transparent px-3 text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white focus:bg-white/10 focus:text-white data-[state=open]:bg-white/10 data-[state=open]:text-white lg:px-4 lg:text-base">
            {t("browse")}
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid w-[min(92vw,720px)] grid-cols-2 gap-6 p-5 md:grid-cols-4 md:p-6">
              {BROWSE_MEGA_MENU.map((column) => (
                <div key={column.id}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    {t(COLUMN_LABEL[column.id] as "browseMovies" | "browseTv" | "browseCollections" | "browseMoods")}
                  </p>
                  <ul className="space-y-0.5">
                    {column.links.map((link) => {
                      const href = `/browse/${link.slug}`;
                      return (
                        <li key={`${column.id}-${link.slug}-${link.title}`}>
                          <NavigationMenuLink asChild>
                            <Link
                              href={href}
                              prefetch
                              onMouseEnter={() => prefetchRoute(href)}
                              onFocus={() => prefetchRoute(href)}
                              className="block rounded-lg px-2 py-1.5 text-sm text-gray-300 transition-colors hover:bg-white/8 hover:text-white focus-ring"
                            >
                              {link.title}
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

export function BrowseMegaMenuMobile({ onNavigate }: { onNavigate: () => void }) {
  const t = useTranslations("nav");
  const prefetchRoute = useRoutePrefetch();

  return (
    <div className="mt-2 space-y-3 border-t border-white/10 pt-3">
      <p className="px-4 text-xs font-semibold uppercase tracking-wider text-gray-500">{t("browse")}</p>
      {BROWSE_MEGA_MENU.map((column) => (
        <div key={column.id}>
          <p className="px-4 pb-1 text-[11px] font-medium uppercase tracking-wider text-gray-600">
            {t(COLUMN_LABEL[column.id] as "browseMovies" | "browseTv" | "browseCollections" | "browseMoods")}
          </p>
          <div className="grid grid-cols-2 gap-1 px-2">
            {column.links.map((link) => {
              const href = `/browse/${link.slug}`;
              return (
                <Link
                  key={`${column.id}-${link.slug}-${link.title}`}
                  href={href}
                  prefetch
                  onMouseEnter={() => prefetchRoute(href)}
                  onFocus={() => prefetchRoute(href)}
                  onClick={onNavigate}
                  className="min-h-[40px] rounded-lg px-2 py-2 text-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-white focus-ring"
                >
                  {link.title}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
