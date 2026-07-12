"use client";

import { useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Film, Tv, Star, Zap } from "lucide-react";

interface MenuSection {
  title: string;
  icon: React.ReactNode;
  items: { label: string; href: string }[];
}

interface BrowseMegaMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BrowseMegaMenu({ isOpen, onClose }: BrowseMegaMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("browse");
  const tn = useTranslations("nav");

  const menuSections = useMemo<MenuSection[]>(
    () => [
      {
        title: t("menuBrowse"),
        icon: <Film className="w-4 h-4" />,
        items: [
          { label: tn("movies"), href: "/movies" },
          { label: tn("tvShows"), href: "/tv-shows" },
          { label: tn("newAndPopular"), href: "/new-and-popular" },
        ],
      },
      {
        title: t("menuGenres"),
        icon: <Zap className="w-4 h-4" />,
        items: [
          { label: t("action"), href: "/browse/action" },
          { label: t("comedy"), href: "/browse/comedy" },
          { label: t("drama"), href: "/browse/drama" },
          { label: t("horror"), href: "/browse/horror" },
          { label: t("sci-fi"), href: "/browse/sci-fi" },
          { label: t("thriller"), href: "/browse/thriller" },
          { label: t("animation"), href: "/browse/animation" },
          { label: t("fantasy"), href: "/browse/fantasy" },
          { label: t("romance"), href: "/browse/romance" },
          { label: t("adventure"), href: "/browse/adventure" },
        ],
      },
      {
        title: t("menuCollections"),
        icon: <Star className="w-4 h-4" />,
        items: [
          { label: t("trending-now"), href: "/browse/trending-now" },
          { label: t("top-rated"), href: "/browse/top-rated" },
          { label: t("now-playing"), href: "/browse/now-playing" },
          { label: t("coming-soon"), href: "/browse/coming-soon" },
        ],
      },
      {
        title: t("menuTv"),
        icon: <Tv className="w-4 h-4" />,
        items: [
          { label: t("trending-tv"), href: "/browse/trending-tv" },
          { label: t("popular-tv"), href: "/browse/popular-tv" },
          { label: t("airing-today"), href: "/browse/airing-today" },
          { label: t("on-the-air"), href: "/browse/on-the-air" },
          { label: t("top-rated-tv"), href: "/browse/top-rated-tv" },
        ],
      },
    ],
    [t, tn]
  );

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute top-full left-0 right-0 z-50 animate-fade-in-up"
    >
      <div className="glass-strong border-b border-white/5 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {menuSections.map((section) => (
              <div key={section.title}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-red-400">{section.icon}</span>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
                    {section.title}
                  </h3>
                </div>
                <ul className="space-y-1.5">
                  {section.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className="block rounded-lg px-3 py-1.5 text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-white hover-lift-sm glow-hover focus-ring"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
