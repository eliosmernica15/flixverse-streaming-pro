"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { pythonFetch } from "@/lib/pythonApi/client";

interface UseBlockReturn {
  isBlocked: boolean;
  loading: boolean;
  toggleBlock: () => Promise<void>;
}

export function usePythonBlock(targetUserId: string | null): UseBlockReturn {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !targetUserId || user.uid === targetUserId) {
      setLoading(false);
      return;
    }

    const checkBlock = async () => {
      try {
        const result = await pythonFetch<{ isBlocked: boolean }>(`/api/flixverse/social/block/${targetUserId}`);
        setIsBlocked(result.isBlocked);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    void checkBlock();
  }, [user, targetUserId]);

  const toggleBlock = useCallback(async () => {
    if (!user || !targetUserId || user.uid === targetUserId) return;

    const prevIsBlocked = isBlocked;
    setIsBlocked(!prevIsBlocked);

    try {
      await pythonFetch(`/api/flixverse/social/block/${targetUserId}`, {
        method: prevIsBlocked ? "DELETE" : "POST",
      });
      toast({
        title: prevIsBlocked ? "Unblocked" : "User blocked",
        description: prevIsBlocked ? "You can now interact with this user." : "They can no longer interact with you.",
      });
    } catch (err) {
      setIsBlocked(prevIsBlocked);
      toast({ title: "Action failed", description: "Could not update block status. Please try again.", variant: "destructive" });
      throw err;
    }
  }, [user, targetUserId, isBlocked, toast]);

  return { isBlocked, loading, toggleBlock };
}