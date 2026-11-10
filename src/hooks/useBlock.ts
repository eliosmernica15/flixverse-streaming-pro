"use client";

import { useState, useEffect, useCallback } from "react";
import { getFirestore, collection, query, where, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isPythonBackendEnabled } from "@/lib/pythonApi/config";
import { usePythonBlock } from "@/hooks/useBlockPython";

function useFirestoreBlock(targetUserId: string | null) {
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
        const db = getFirestore();
        // Check if current user has blocked target
        const blockQ = query(
          collection(db, "blocks"),
          where("blockerId", "==", user.uid),
          where("blockedId", "==", targetUserId)
        );
        const snap = await getDocs(blockQ);
        setIsBlocked(!snap.empty);
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

    const db = getFirestore();
    const prevIsBlocked = isBlocked;

    // Optimistic update — rollback on failure
    setIsBlocked(!prevIsBlocked);

    try {
      if (prevIsBlocked) {
        // Unblock
        const blockQ = query(
          collection(db, "blocks"),
          where("blockerId", "==", user.uid),
          where("blockedId", "==", targetUserId)
        );
        const snap = await getDocs(blockQ);
        for (const d of snap.docs) {
          await deleteDoc(doc(db, "blocks", d.id));
        }
        toast({ title: "Unblocked", description: "You can now interact with this user." });
      } else {
        // Block
        await addDoc(collection(db, "blocks"), {
          blockerId: user.uid,
          blockedId: targetUserId,
          createdAt: Date.now(),
        });
        toast({ title: "User blocked", description: "They can no longer interact with you." });
      }
    } catch (err) {
      // Rollback optimistic state on failure
      setIsBlocked(prevIsBlocked);
      toast({ title: "Action failed", description: "Could not update block status. Please try again.", variant: "destructive" });
      throw err;
    }
  }, [user, targetUserId, isBlocked, toast]);

  return { isBlocked, loading, toggleBlock };
}

export function useBlock(targetUserId: string | null) {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- transport dispatch: environment-constant per origin
  return isPythonBackendEnabled() ? usePythonBlock(targetUserId) : useFirestoreBlock(targetUserId);
}