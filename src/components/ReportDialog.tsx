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
      <div className="relative w-full max-w-sm bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl animate-scale-in overflow-hidden">
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-red-400" />
            <h2 className="font-bold text-white text-sm">Report Content</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg" aria-label="Close">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">
              Reason
            </label>
            <div className="space-y-1.5">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    reason === r
                      ? "bg-red-500/20 border border-red-500/30 text-red-400"
                      : "bg-white/5 border border-white/5 text-gray-400 hover:text-white"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">
              Additional details (optional)
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Provide more context…"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-white/20 resize-none"
            />
          </div>
        </div>

        <div className="p-5 pt-0 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason || submitting}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-30 text-xs font-semibold text-white transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {submitting ? "Submitting…" : "Submit Report"}
          </button>
        </div>
      </div>
    </div>
  );
}
