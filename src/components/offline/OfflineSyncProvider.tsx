"use client";

import { useEffect, useState } from "react";
import { MutationDispatcher } from "@/lib/offline/mutationDispatcher";
import { useToast } from "@/hooks/use-toast";

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: "You are back online",
        description: "Syncing your offline actions...",
      });
      MutationDispatcher.syncOutbox().then(() => {
        // Optionally show success message
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "You are offline",
        description: "Actions will be saved and synced when you reconnect.",
        variant: "destructive",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial sync check
    if (navigator.onLine) {
      MutationDispatcher.syncOutbox();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [toast]);

  return <>{children}</>;
}
