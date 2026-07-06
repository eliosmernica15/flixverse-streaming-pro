const DB_NAME = "flixverse-offline-v2";
const DB_VERSION = 2;
const STORE = "cache";
const OUTBOX_STORE = "outbox";

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
    };
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
