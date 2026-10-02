/**
 * Offline download manager — stores title metadata, poster blob, and optional trailer.
 * Full video downloads require content hosted on Firebase Storage (OFFLINE_DOWNLOAD_BASE_URL).
 */

import {
  saveDownloadRecord,
  updateDownloadRecord,
  getDownloadRecords,
  deleteDownloadRecord,
  type OfflineDownloadRecord,
} from "@/lib/offlineStorage";
import { getImageUrl } from "@/utils/tmdbApi";

export type DownloadProgress = {
  id: string;
  status: OfflineDownloadRecord["status"];
  progress: number;
  error?: string;
};

type DownloadRequest = {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  season?: number;
  episode?: number;
  trailerKey?: string;
};

function downloadId(req: DownloadRequest): string {
  if (req.mediaType === "tv" && req.season && req.episode) {
    return `tv-${req.tmdbId}-s${req.season}e${req.episode}`;
  }
  return `movie-${req.tmdbId}`;
}

async function fetchBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

const listeners = new Set<(progress: DownloadProgress) => void>();

function notify(progress: DownloadProgress) {
  listeners.forEach((fn) => fn(progress));
}

export function subscribeDownloadProgress(fn: (progress: DownloadProgress) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function enqueueDownload(req: DownloadRequest): Promise<string> {
  const id = downloadId(req);
  const existing = (await getDownloadRecords()).find((d) => d.id === id);
  if (existing?.status === "complete") return id;

  const record: OfflineDownloadRecord = {
    id,
    tmdbId: req.tmdbId,
    mediaType: req.mediaType,
    title: req.title,
    posterPath: req.posterPath,
    season: req.season,
    episode: req.episode,
    status: "queued",
    progress: 0,
    sizeBytes: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    trailerKey: req.trailerKey,
  };

  await saveDownloadRecord(record);
  notify({ id, status: "queued", progress: 0 });

  void processDownload(id, req);
  return id;
}

async function processDownload(id: string, req: DownloadRequest) {
  try {
    await updateDownloadRecord(id, { status: "downloading", progress: 5 });
    notify({ id, status: "downloading", progress: 5 });

    let posterBlob: Blob | undefined;
    if (req.posterPath) {
      const posterUrl = getImageUrl(req.posterPath, "large");
      const blob = await fetchBlob(posterUrl);
      if (blob) posterBlob = blob;
    }
    await updateDownloadRecord(id, { progress: 35, posterBlob });
    notify({ id, status: "downloading", progress: 35 });

    let trailerBlob: Blob | undefined;
    if (req.trailerKey) {
      const manifestRes = await fetch(
        `/api/offline/manifest?key=${encodeURIComponent(req.trailerKey)}`
      );
      if (manifestRes.ok) {
        const { url } = (await manifestRes.json()) as { url?: string };
        if (url) {
          const blob = await fetchBlob(url);
          if (blob) trailerBlob = blob;
        }
      }
    }
    await updateDownloadRecord(id, { progress: 70, trailerBlob });
    notify({ id, status: "downloading", progress: 70 });

    const sizeBytes = (posterBlob?.size ?? 0) + (trailerBlob?.size ?? 0);
    await updateDownloadRecord(id, {
      status: "complete",
      progress: 100,
      sizeBytes,
      completedAt: Date.now(),
    });
    notify({ id, status: "complete", progress: 100 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Download failed";
    await updateDownloadRecord(id, { status: "error", error: message });
    notify({ id, status: "error", progress: 0, error: message });
  }
}

export async function removeDownload(id: string): Promise<void> {
  await deleteDownloadRecord(id);
  notify({ id, status: "error", progress: 0 });
}

export async function listDownloads(): Promise<OfflineDownloadRecord[]> {
  return getDownloadRecords();
}

export function formatDownloadSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
