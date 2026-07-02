"use client";

import { createContext, useContext } from "react";
import { useWatchHistory as useWatchHistoryHook } from "@/hooks/useWatchHistory";

type WatchHistoryContextValue = ReturnType<typeof useWatchHistoryHook>;

const WatchHistoryContext = createContext<WatchHistoryContextValue | null>(null);

export function WatchHistoryProvider({ children }: { children: React.ReactNode }) {
  const value = useWatchHistoryHook();

  return (
    <WatchHistoryContext.Provider value={value}>{children}</WatchHistoryContext.Provider>
  );
}

export function useWatchHistoryContext() {
  const context = useContext(WatchHistoryContext);
  if (!context) {
    throw new Error("useWatchHistoryContext must be used within WatchHistoryProvider");
  }
  return context;
}
