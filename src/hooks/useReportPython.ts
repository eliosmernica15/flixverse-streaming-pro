"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { pythonFetch } from "@/lib/pythonApi/client";

interface UseReportReturn {
  submitReport: (
    targetType: "profile" | "review" | "comment" | "timeline_comment",
    targetId: string,
    targetOwnerId: string | undefined,
    reason: string,
    details?: string
  ) => Promise<boolean>;
  submitting: boolean;
}

export function usePythonReport(): UseReportReturn {
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
      await pythonFetch("/api/flixverse/social/report", {
        method: "POST",
        body: JSON.stringify({
          targetType,
          targetId,
          targetOwnerId,
          reason,
          details,
        }),
      });
      toast({ title: "Report submitted", description: "Thank you for helping keep FlixVerse safe." });
      return true;
    } catch (err) {
      console.error("Report submission failed:", err);
      toast({ title: "Error", description: "Failed to submit report.", variant: "destructive" });
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [user, toast]);

  return { submitReport, submitting };
}