const DB_NAME = "flixverse-offline-v2";
const DB_VERSION = 3;
const STORE = "cache";
const OUTBOX_STORE = "outbox";
const DOWNLOADS_STORE = "downloads";

export interface OfflineCatalogItem {
  id: number;
  title: string;
  poster_path: string | null;
  media_type: "movie" | "tv";
  cached_at: string;
}

export interface OfflineCachePayload {
  watchlist: OfflineCatalogItem[];
  continueWatching: OfflineCatalogItem[];
  updated_at: string;
}

export interface MutationAction {
  id: string; // uuid
  type: "ADD_WATCHLIST" | "REMOVE_WATCHLIST" | "RATE_CONTENT" | "UPDATE_PROGRESS";
  payload: any;
  timestamp: string;
}

export interface OfflineDownloadRecord {
  id: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  season?: number;
  episode?: number;
  status: "queued" | "downloading" | "complete" | "error";
  progress: number;
  sizeBytes: number;
  posterBlob?: Blob;
  trailerBlob?: Blob;
  trailerKey?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(DOWNLOADS_STORE)) {
        db.createObjectStore(DOWNLOADS_STORE, { keyPath: "id" });
      }
    };
  });
}

export async function saveDownloadRecord(record: OfflineDownloadRecord): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOWNLOADS_STORE, "readwrite");
    tx.objectStore(DOWNLOADS_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateDownloadRecord(
  id: string,
  patch: Partial<OfflineDownloadRecord>
): Promise<void> {
  const records = await getDownloadRecords();
  const existing = records.find((r) => r.id === id);
  if (!existing) return;
  await saveDownloadRecord({ ...existing, ...patch, updatedAt: Date.now() });
}

export async function getDownloadRecords(): Promise<OfflineDownloadRecord[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DOWNLOADS_STORE, "readonly");
      const req = tx.objectStore(DOWNLOADS_STORE).getAll();
      req.onsuccess = () => resolve((req.result as OfflineDownloadRecord[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function deleteDownloadRecord(id: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOWNLOADS_STORE, "readwrite");
    tx.objectStore(DOWNLOADS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveMutationToOutbox(action: MutationAction): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, "readwrite");
    tx.objectStore(OUTBOX_STORE).put(action);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOutboxMutations(): Promise<MutationAction[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, "readonly");
      const req = tx.objectStore(OUTBOX_STORE).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function clearOutboxMutation(id: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, "readwrite");
    tx.objectStore(OUTBOX_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveOfflineCache(data: OfflineCachePayload): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(data, "catalog");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadOfflineCache(): Promise<OfflineCachePayload | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get("catalog");
      req.onsuccess = () => resolve((req.result as OfflineCachePayload) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}
