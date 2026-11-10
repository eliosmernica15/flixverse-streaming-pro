"use client";

import { useState, useCallback } from "react";
import { getFirestore, collection, addDoc, query, where, getDocs, doc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { enqueuePendingJob } from "@/lib/pendingJobs";
import { isPythonBackendEnabled } from "@/lib/pythonApi/config";
import { usePythonReport } from "@/hooks/useReportPython";

function useFirestoreReport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const submitReport = useCallback(async (
    targetType: "profile" | "review" | "comment" | "timeline_comment",
    targetId: string,
    targetOwnerId: string | undefined,
    reason: string,
    details?: string
  ) => {
    if (!user) return false;

    setSubmitting(true);
    try {
      const db = getFirestore();
      await addDoc(collection(db, "reports"), {
        reporterId: user.uid,
        targetType,
        targetId,
        targetOwnerId: targetOwnerId || null,
        reason,
        details: details?.trim() || null,
        status: "pending",
        createdAt: Date.now(),
      });
      toast({ title: "Report submitted", description: "Thank you for helping keep FlixVerse safe." });

      // Enqueue notification job if reporting a profile/user
      if (targetType === "profile" && targetOwnerId && targetOwnerId !== user.uid) {
        void enqueuePendingJob(user.uid, "moderation_report", {
          toUserId: targetOwnerId,
          fromUserId: user.uid,
          message: "Someone reported your profile.",
        });
      }
      return true;
    } catch {
      toast({ title: "Error", description: "Failed to submit report.", variant: "destructive" });
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [user, toast]);

  return { submitReport, submitting };
}

export function useReport() {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- transport dispatch: environment-constant per origin
  return isPythonBackendEnabled() ? usePythonReport() : useFirestoreReport();
}