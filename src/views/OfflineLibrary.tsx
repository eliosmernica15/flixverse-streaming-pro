"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { WifiOff, Download, Film, Info } from "lucide-react";
import { loadOfflineCache, type OfflineCachePayload } from "@/lib/offlineStorage";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getImageUrl } from "@/utils/tmdbApi";
import PageContainer from "@/components/PageContainer";
import PageHero from "@/components/PageHero";
import SectionHeader from "@/components/SectionHeader";
import Reveal from "@/components/Reveal";
import EmptyState from "@/components/EmptyState";

const OfflineLibrary = () => {
  const isOnline = useOnlineStatus();
  const [cache, setCache] = useState<OfflineCachePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOfflineCache().then((data) => {
      setCache(data);
      setLoading(false);
    });
  }, []);

  const hasItems =
    (cache?.watchlist?.length ?? 0) > 0 || (cache?.continueWatching?.length ?? 0) > 0;

  return (
    <div className="pt-20 min-h-screen">
      <PageHero
        title="Offline Library"
        subtitle="Your saved catalog for when you're without internet. Posters and pages you've visited may still load — streaming requires a connection."
        icon={<WifiOff className="w-6 h-6 text-white" />}
        accent="amber"
      />

      <PageContainer>
        {!isOnline && (
          <div className="mb-8 flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-100 text-sm">
            <WifiOff className="w-5 h-5 shrink-0" />
            You&apos;re offline. Items below were saved while you were online.
          </div>
        )}

        <section className="mb-12 p-6 rounded-2xl glass-panel">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
              <Download className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Movie downloads — coming soon</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Full offline playback needs videos hosted on our servers. We&apos;re preparing a Downloads feature for owned/licensed content. For now, use this library to browse cached titles offline.
              </p>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-2xl skeleton-shimmer" />
            ))}
          </div>
        ) : !hasItems ? (
          <EmptyState
            icon={<Film className="w-12 h-12 text-gray-600" />}
            title="Nothing cached yet"
            description="Sign in and add titles to My List or start watching — we'll save them here for offline browsing."
            actionLabel="Browse movies"
            actionHref="/movies"
          />
        ) : (
          <div className="space-y-12">
            {cache?.continueWatching && cache.continueWatching.length > 0 && (
              <Reveal as="section" className="mb-12">
                <SectionHeader title="Continue watching" eyebrow="Cached" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-2">
                  {cache.continueWatching.map((item) => (
                    <Link
                      key={`cw-${item.id}-${item.media_type}`}
                      href={`/movie/${item.id}?type=${item.media_type}`}
                      className="group block hover-lift-sm rounded-2xl focus-ring"
                    >
                      <div className="aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 group-hover:border-red-500/40 transition-colors relative">
                        {item.poster_path ? (
                          <Image
                            src={getImageUrl(item.poster_path, "medium")}
                            alt={item.title}
                            fill
                            sizes="(max-width: 768px) 50vw, 16vw"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-white/5 flex items-center justify-center">
                            <Film className="w-8 h-8 text-gray-600" />
                          </div>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-gray-300 line-clamp-2 group-hover:text-white">{item.title}</p>
                    </Link>
                  ))}
                </div>
              </Reveal>
            )}

            {cache?.watchlist && cache.watchlist.length > 0 && (
                <Reveal as="section" className="mb-12">
                  <SectionHeader title="My List" eyebrow="Cached" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-2">
                    {cache.watchlist.map((item) => (
                      <Link
                        key={`wl-${item.id}-${item.media_type}`}
                        href={`/movie/${item.id}?type=${item.media_type}`}
                        className="group block hover-lift-sm rounded-2xl focus-ring"
                      >
                      <div className="aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 group-hover:border-red-500/40 transition-colors relative">
                        {item.poster_path ? (
                          <Image
                            src={getImageUrl(item.poster_path, "medium")}
                            alt={item.title}
                            fill
                            sizes="(max-width: 768px) 50vw, 16vw"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-white/5 flex items-center justify-center">
                            <Film className="w-8 h-8 text-gray-600" />
                          </div>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-gray-300 line-clamp-2 group-hover:text-white">{item.title}</p>
                    </Link>
                  ))}
                </div>
              </Reveal>
            )}
          </div>
        )}

        <div className="mt-12 p-4 rounded-xl bg-white/5 border border-white/10 flex gap-3 text-sm text-gray-400">
          <Info className="w-5 h-5 shrink-0 text-gray-500" />
          <p>
            Offline mode caches posters and pages you&apos;ve visited. Video streaming always needs an internet connection until our Downloads feature launches with hosted files.
          </p>
        </div>
      </PageContainer>
    </div>
  );
};

export default OfflineLibrary;
