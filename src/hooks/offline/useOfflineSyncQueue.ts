import { useState, useEffect, useCallback } from "react";
import {
  getOutboxMutations,
  clearOutboxMutation,
  type MutationAction,
} from "@/lib/offlineStorage";
import { MutationDispatcher } from "@/lib/offline/mutationDispatcher";

interface UseOfflineSyncQueueReturn {
  /** Number of pending mutations in the outbox */
  pendingCount: number;
  /** Whether a sync is currently in progress */
  isSyncing: boolean;
  /** Manually trigger a sync */
  syncNow: () => Promise<void>;
  /** The most recent sync error, if any */
  lastError: Error | null;
}

export function useOfflineSyncQueue(): UseOfflineSyncQueueReturn {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);

  // Refresh pending count from IDB
  const refreshCount = useCallback(async () => {
    try {
      const mutations = await getOutboxMutations();
      setPendingCount(mutations.length);
    } catch {
      // ignore
    }
  }, []);

  // Initial count
  useEffect(() => {
    void refreshCount();
  }, [refreshCount]);

  // Listen for online event to auto-sync
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      void syncNow();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  const syncNow = useCallback(async () => {
    if (isSyncing || typeof navigator === "undefined" || !navigator.onLine) return;

    setIsSyncing(true);
    setLastError(null);

    try {
      await MutationDispatcher.syncOutbox();
      await refreshCount();
    } catch (err) {
      setLastError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshCount]);

  return { pendingCount, isSyncing, syncNow, lastError };
}
