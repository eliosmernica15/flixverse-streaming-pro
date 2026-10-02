"use client";

import { useState } from "react";
import { Flag, X, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isRateLimited } from "@/lib/rateLimit";

interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: "review" | "comment" | "timeline_comment" | "profile";
  targetId: string;
  targetOwnerId?: string;
}

const REPORT_REASONS = [
  "Spam or misleading",
  "Harassment or bullying",
  "Hate speech",
  "Violent or graphic content",
  "Sexual content",
  "Misinformation",
  "Other",
];

export function ReportDialog({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetOwnerId,
}: ReportDialogProps) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!user || !reason) return;

    if (isRateLimited("REPORT", user.uid)) {
      toast({ title: "Rate limited", description: "Too many reports. Please try again later.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { getFirestore, collection, addDoc } = await import("firebase/firestore");
      const db = getFirestore();
      await addDoc(collection(db, "reports"), {
        reporterId: user.uid,
        targetType,
        targetId,
        targetOwnerId: targetOwnerId || null,
        reason,
        details: details.trim() || null,
        status: "pending",
        createdAt: Date.now(),
      });
      toast({ title: "Report submitted", description: "Thank you for helping keep FlixVerse safe." });
      onClose();
      setReason("");
      setDetails("");
    } catch {
      toast({ title: "Error", description: "Failed to submit report.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm animate-scale-in overflow-hidden rounded-2xl border-white/10 glass-strong">
        <div className="flex items-center justify-between border-b border-white/10 p-5">
          <div className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-red-400" />
            <h2 className="text-sm font-bold text-white">Report Content</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 transition-colors hover:bg-white/10 focus-ring" aria-label="Close">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Reason
            </label>
            <div className="space-y-1.5">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors focus-ring ${
                    reason === r
                      ? "border-red-500/30 bg-red-500/20 text-red-400"
                      : "border-white/5 bg-white/5 text-gray-400 hover:text-white"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Additional details (optional)
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Provide more context…"
              className="focus-ring w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-gray-600 focus:border-white/20"
            />
          </div>
        </div>

        <div className="flex gap-2 p-5 pt-0">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-gray-400 transition-colors hover:text-white focus-ring"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason || submitting}
            className="btn-primary flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white transition-colors disabled:opacity-30 focus-ring"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {submitting ? "Submitting…" : "Submit Report"}
          </button>
        </div>
      </div>
    </div>
  );
}
