"use client";

import { useSyncExternalStore } from "react";

/**
 * Subscribes to the "myMovieList" key in localStorage and returns whether
 * the given id is in it. Avoids per-card `useState` + `useEffect` churn
 * that runs on every MovieCard mount.
 */
let cachedRaw: string | null | undefined;
let cachedList: number[] = [];

function getSnapshot(listKey: string): number[] {
  if (typeof window === "undefined") return EMPTY_LIST;
  try {
    const raw = localStorage.getItem(listKey);
    if (raw === cachedRaw) return cachedList;
    cachedRaw = raw;
    if (!raw) {
      cachedList = EMPTY_LIST;
      return cachedList;
    }
    const parsed = JSON.parse(raw);
    cachedList = Array.isArray(parsed) ? parsed : EMPTY_LIST;
    return cachedList;
  } catch {
    cachedRaw = null;
    cachedList = EMPTY_LIST;
    return cachedList;
  }
}

function getServerSnapshot(): number[] {
  return EMPTY_LIST;
}

const EMPTY_LIST: number[] = [];
const LIST_KEY = "myMovieList";

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (e: StorageEvent) => {
    if (e.key === LIST_KEY) {
      cachedRaw = undefined;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

export function useLocalMovieListContains(enabled: boolean, id: number): boolean {
  const list = useSyncExternalStore(subscribe, () => getSnapshot(LIST_KEY), getServerSnapshot);
  if (!enabled) return false;
  return list.includes(id);
}
