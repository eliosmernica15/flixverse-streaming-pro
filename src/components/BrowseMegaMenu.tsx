"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, Film, Tv, TrendingUp, Star, Clock, Zap } from "lucide-react";

interface MenuSection {
  title: string;
  icon: React.ReactNode;
  items: { label: string; href: string }[];
}

const MENU_SECTIONS: MenuSection[] = [
  {
    title: "Browse",
    icon: <Film className="w-4 h-4" />,
    items: [
      { label: "Movies", href: "/movies" },
      { label: "TV Shows", href: "/tv-shows" },
      { label: "New & Popular", href: "/new-and-popular" },
    ],
  },
  {
    title: "Genres",
    icon: <Zap className="w-4 h-4" />,
    items: [
      { label: "Action", href: "/browse/action" },
      { label: "Comedy", href: "/browse/comedy" },
      { label: "Drama", href: "/browse/drama" },
      { label: "Horror", href: "/browse/horror" },
      { label: "Sci-Fi", href: "/browse/sci-fi" },
      { label: "Thriller", href: "/browse/thriller" },
      { label: "Animation", href: "/browse/animation" },
      { label: "Fantasy", href: "/browse/fantasy" },
      { label: "Romance", href: "/browse/romance" },
      { label: "Adventure", href: "/browse/adventure" },
    ],
  },
  {
    title: "Collections",
    icon: <Star className="w-4 h-4" />,
    items: [
      { label: "Trending Now", href: "/browse/trending-now" },
      { label: "Top Rated", href: "/browse/top-rated" },
      { label: "Now Playing", href: "/browse/now-playing" },
      { label: "Coming Soon", href: "/browse/coming-soon" },
    ],
  },
  {
    title: "TV",
    icon: <Tv className="w-4 h-4" />,
    items: [
      { label: "Trending TV", href: "/browse/trending-tv" },
      { label: "Popular TV", href: "/browse/popular-tv" },
      { label: "Airing Today", href: "/browse/airing-today" },
      { label: "On The Air", href: "/browse/on-the-air" },
      { label: "Top Rated TV", href: "/browse/top-rated-tv" },
    ],
  },
];

interface BrowseMegaMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BrowseMegaMenu({ isOpen, onClose }: BrowseMegaMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

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
            {MENU_SECTIONS.map((section) => (
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
