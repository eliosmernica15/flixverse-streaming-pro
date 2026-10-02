"use client";

import { useSyncExternalStore } from "react";

/**
 * Subscribes to the "myMovieList" key in localStorage and returns whether
 * the given id is in it. Avoids per-card `useState` + `useEffect` churn
 * that runs on every MovieCard mount.
 */
function getSnapshot(listKey: string): number[] {
  if (typeof window === "undefined") return EMPTY_LIST;
  try {
    const raw = localStorage.getItem(listKey);
    if (!raw) return EMPTY_LIST;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : EMPTY_LIST;
  } catch {
    return EMPTY_LIST;
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
    if (e.key === LIST_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

export function useLocalMovieListContains(enabled: boolean, id: number): boolean {
  const list = useSyncExternalStore(subscribe, () => getSnapshot(LIST_KEY), getServerSnapshot);
  if (!enabled) return false;
  return list.includes(id);
}
