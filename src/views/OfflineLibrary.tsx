"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { WifiOff, Download, Film, Trash2, Play } from "lucide-react";
import { loadOfflineCache, type OfflineCachePayload } from "@/lib/offlineStorage";
import { listDownloads, removeDownload, formatDownloadSize } from "@/lib/offline/downloadManager";
import type { OfflineDownloadRecord } from "@/lib/offlineStorage";
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
  const [downloads, setDownloads] = useState<OfflineDownloadRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const [cacheData, downloadData] = await Promise.all([loadOfflineCache(), listDownloads()]);
    setCache(cacheData);
    setDownloads(downloadData.filter((d) => d.status !== "error"));
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const hasItems =
    (cache?.watchlist?.length ?? 0) > 0 ||
    (cache?.continueWatching?.length ?? 0) > 0 ||
    downloads.length > 0;

  const handleDelete = async (id: string) => {
    await removeDownload(id);
    void refresh();
  };

  return (
    <div className="pt-20 min-h-screen">
      <PageHero
        title="Offline Library"
        subtitle="Browse cached titles and play downloaded trailers offline. Full video downloads require Premium and hosted content."
        icon={<WifiOff className="w-6 h-6 text-white" />}
        accent="amber"
      />

      <PageContainer>
        {!isOnline && (
          <div className="mb-8 flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-100 text-sm">
            <WifiOff className="w-5 h-5 shrink-0" />
            You&apos;re offline. Cached and downloaded items below are available.
          </div>
        )}

        {downloads.length > 0 && (
          <Reveal as="section" className="mb-12">
            <SectionHeader title="Downloads" eyebrow="Offline" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {downloads.map((item) => (
                <div
                  key={item.id}
                  className="glass-panel rounded-2xl p-4 flex gap-4 border border-white/10"
                >
                  <div className="relative w-20 h-28 rounded-xl overflow-hidden shrink-0 bg-white/5">
                    {item.posterPath ? (
                      <Image
                        src={getImageUrl(item.posterPath, "small")}
                        alt={item.title}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Film className="w-8 h-8 text-gray-600" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm line-clamp-2">{item.title}</p>
                    {item.mediaType === "tv" && item.season && item.episode && (
                      <p className="text-xs text-gray-400 mt-0.5">S{item.season} E{item.episode}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {item.status === "complete"
                        ? formatDownloadSize(item.sizeBytes)
                        : `${item.progress}% · ${item.status}`}
                    </p>
                    <div className="flex gap-2 mt-3">
                      {item.status === "complete" && (
                        <Link
                          href={`/movie/${item.tmdbId}?type=${item.mediaType}${item.season ? `&season=${item.season}&episode=${item.episode}` : ""}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-300"
                        >
                          <Play className="w-3 h-3" />
                          Play
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDelete(item.id)}
                        className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        )}

        {downloads.length === 0 && (
          <section className="mb-12 p-6 rounded-2xl glass-panel">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                <Download className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Download titles from any movie page</h2>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Premium members can download metadata, posters, and trailers for offline browsing.
                  Tap the download button on a title&apos;s detail page to get started.
                </p>
              </div>
            </div>
          </section>
        )}

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
      </PageContainer>
    </div>
  );
};

export default OfflineLibrary;
