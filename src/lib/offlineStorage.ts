const DB_NAME = "flixverse-offline-v1";
const DB_VERSION = 1;
const STORE = "cache";

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
    };
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
