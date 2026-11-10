"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { WifiOff, Download, Film, Trash2, Play, HardDrive, Check, X, Film as FilmIcon, Archive } from "lucide-react";
import { loadOfflineCache, type OfflineCachePayload } from "@/lib/offlineStorage";
import { listDownloads, removeDownload, formatDownloadSize } from "@/lib/offline/downloadManager";
import type { OfflineDownloadRecord } from "@/lib/offlineStorage";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getImageUrl } from "@/utils/tmdbApi";
import PageContainer from "@/components/PageContainer";
import SectionHeader from "@/components/SectionHeader";
import Reveal from "@/components/Reveal";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/hooks/use-toast";

// ~50 MB browser quota the download manager targets.
const DOWNLOAD_QUOTA_BYTES = 50 * 1024 * 1024;

type LibraryTab = "downloads" | "cached";

const OfflineLibrary = () => {
  const isOnline = useOnlineStatus();
  const { toast } = useToast();
  const [cache, setCache] = useState<OfflineCachePayload | null>(null);
  const [downloads, setDownloads] = useState<OfflineDownloadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<LibraryTab>("downloads");
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  // Multi-select handlers (following MyList pattern)
  const toggleSelectAll = useCallback(() => {
    const currentDownloads = tab === "downloads" ? downloads : [];
    if (selectedIds.size === currentDownloads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentDownloads.map(d => d.id)));
    }
  }, [downloads, tab, selectedIds.size]);

  const toggleSelect = useCallback((downloadId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(downloadId)) {
        next.delete(downloadId);
      } else {
        next.add(downloadId);
      }
      return next;
    });
  }, []);

  const handleBulkRemove = useCallback(async () => {
    if (selectedIds.size === 0) return;

    try {
      await Promise.all(Array.from(selectedIds).map(id => removeDownload(id)));
      toast({
        title: "Downloads removed",
        description: `${selectedIds.size} download${selectedIds.size === 1 ? "" : "s"} removed from your library.`,
      });
      setSelectedIds(new Set());
      setIsMultiSelect(false);
      void refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove some downloads. Please try again.",
        variant: "destructive",
      });
    }
  }, [selectedIds, toast]);

  const exitMultiSelect = useCallback(() => {
    setIsMultiSelect(false);
    setSelectedIds(new Set());
  }, []);

  // B4 — storage meter: total size of completed downloads against the
  // ~50 MB browser quota used by the download manager.
  const storage = useMemo(() => {
    const usedBytes = downloads
      .filter((d) => d.status === "complete")
      .reduce((sum, d) => sum + (d.sizeBytes || 0), 0);
    const pct = Math.min(100, Math.round((usedBytes / DOWNLOAD_QUOTA_BYTES) * 100));
    return { usedBytes, pct, fmt: formatDownloadSize(usedBytes) };
  }, [downloads]);

  const cachedCount = useMemo(() => {
    return (cache?.watchlist?.length ?? 0) + (cache?.continueWatching?.length ?? 0);
  }, [cache]);

  const downloadsCount = useMemo(() => downloads.length, [downloads]);

  const tabs = [
    { id: "downloads" as LibraryTab, label: "Downloads", count: downloadsCount, icon: Download },
    { id: "cached" as LibraryTab, label: "Cached", count: cachedCount, icon: Archive },
  ];

  return (
    <div className="relative">
      {/* Cinematic header (like MyList) */}
      <header className="relative pt-24 pb-10 px-4 sm:px-6 lg:px-10 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 60% 60% at 50% 0%, rgba(245, 158, 11, 0.18) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(168, 85, 247, 0.12) 0%, transparent 60%)",
          }}
        />
        <div className="max-w-[1800px] mx-auto flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400 mb-1.5">
              Offline Library
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-[1.05] hero-text-shadow">
              Your offline collection
            </h1>
            <p className="text-gray-400 text-sm sm:text-base mt-2">
              {loading
                ? "Loading your offline content…"
                : !hasItems
                ? "Nothing cached yet — start watching or download titles to build your library."
                : `${downloadsCount} download${downloadsCount === 1 ? "" : "s"} · ${cachedCount} cached title${cachedCount === 1 ? "" : "s"}`}
            </p>
          </div>
          {!loading && hasItems && (
            <div className="flex items-center gap-3 self-start sm:self-auto">
              {!isMultiSelect && downloadsCount > 0 && (
                <button
                  type="button"
                  onClick={() => setIsMultiSelect(true)}
                  className="group inline-flex items-center gap-2 rounded-md border border-white/20 bg-black/30 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 hover:border-white/30"
                >
                  <Check className="h-4 w-4" />
                  Select
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <PageContainer className="!pt-0">
        {!isOnline && (
          <div className="mb-8 flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-100 text-sm">
            <WifiOff className="w-5 h-5 shrink-0" />
            You&apos;re offline. Cached and downloaded items below are available.
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-2xl skeleton-shimmer" />
            ))}
          </div>
        ) : !hasItems ? (
          <EmptyState
            icon={<FilmIcon className="w-12 h-12 text-gray-600" />}
            title="Nothing cached yet"
            description="Sign in and add titles to My List or start watching — we'll save them here for offline browsing."
            actionLabel="Browse movies"
            actionHref="/movies"
          />
        ) : (
          <>
            {/* Storage meter (only show when there are downloads) */}
            {downloadsCount > 0 && (
              <div className="mb-8 flex items-center gap-3 glass-panel rounded-2xl border border-white/10 p-4">
                <HardDrive className="w-5 h-5 shrink-0 text-amber-300" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs text-gray-300 mb-1.5">
                    <span>{storage.fmt} of downloads stored</span>
                    <span className="text-gray-500 tabular-nums">{storage.pct}%</span>
                  </div>
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
                    role="progressbar"
                    aria-valuenow={storage.pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Offline storage used"
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                      style={{ width: `${storage.pct}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab navigation (following MyList pattern) */}
            <div className="glass-soft rounded-lg p-2 mb-6 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    aria-pressed={tab === t.id}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      tab === t.id
                        ? "bg-white text-black"
                        : "text-gray-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <t.icon className="h-3.5 w-3.5" />
                    {t.label}
                    <span
                      className={`text-[10px] font-bold tabular-nums ${
                        tab === t.id ? "text-black/60" : "text-gray-500"
                      }`}
                    >
                      {t.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Multi-select bar (following MyList pattern) */}
            {isMultiSelect && tab === "downloads" && downloadsCount > 0 && (
              <div className="glass-panel border border-white/10 rounded-lg p-3 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={exitMultiSelect}
                    className="flex items-center gap-1.5 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                    aria-label="Exit selection mode"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                  <span className="badge-pill bg-white/10 text-white text-xs font-semibold px-3 py-1">
                    {selectedIds.size} of {downloadsCount} selected
                  </span>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors"
                  >
                    {selectedIds.size === downloadsCount ? "Deselect All" : "Select All"}
                  </button>
                </div>
                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkRemove}
                    className="cta-secondary flex items-center gap-1.5 px-4 py-2 text-sm font-semibold self-start sm:self-auto"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove {selectedIds.size} item{selectedIds.size === 1 ? "" : "s"}
                  </button>
                )}
              </div>
            )}

            {/* Tab content */}
            {tab === "downloads" && (
              <>
                {downloadsCount > 0 ? (
                  <Reveal as="section" className="mb-12">
                    <SectionHeader title="Downloads" eyebrow="Offline" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                      {downloads.map((item) => {
                        const isSelected = selectedIds.has(item.id);
                        return (
                          <div
                            key={item.id}
                            className={`relative group ${isMultiSelect ? "cursor-pointer" : ""}`}
                            onClick={isMultiSelect ? () => toggleSelect(item.id) : undefined}
                          >
                            <div className="glass-panel rounded-2xl p-4 flex gap-4 border border-white/10">
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
                                {item.status === "downloading" && (
                                  <div className="h-1 w-full bg-white/10 rounded-full mt-2 overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-300"
                                      style={{ width: `${item.progress}%` }}
                                    />
                                  </div>
                                )}
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
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleDelete(item.id);
                                    }}
                                    className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-400"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                            {isMultiSelect && (
                              <div
                                className={`absolute top-2 left-2 z-30 flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all duration-200 ${
                                  isSelected
                                    ? "border-red-500 bg-red-500"
                                    : "border-white/50 bg-black/50 hover:border-white hover:bg-white/10"
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSelect(item.id);
                                }}
                              >
                                {isSelected && <Check className="h-4 w-4 text-white" />}
                              </div>
                            )}
                            {isMultiSelect && isSelected && (
                              <div
                                className="absolute inset-0 bg-red-500/20 rounded-[6px] ring-2 ring-red-500/50 pointer-events-none"
                                aria-hidden="true"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Reveal>
                ) : (
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
              </>
            )}

            {tab === "cached" && (
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

                {(!cache?.continueWatching?.length && !cache?.watchlist?.length) && (
                  <div className="glass-soft rounded-2xl py-12 text-center">
                    <p className="text-gray-300 text-sm">No cached content yet.</p>
                    <p className="text-gray-500 text-xs mt-1">Start watching titles to build your cached library.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </PageContainer>
    </div>
  );
};

export default OfflineLibrary;