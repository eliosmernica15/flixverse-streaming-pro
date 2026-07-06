"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send } from "lucide-react";

interface AddCommentDialogProps {
  timestamp: number;
  onSubmit: (text: string) => Promise<void>;
  onClose: () => void;
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function AddCommentDialog({ timestamp, onSubmit, onClose }: AddCommentDialogProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSubmit = async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(text.trim());
    } catch (err) {
      console.error("Failed to add comment:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl animate-scale-in overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-white text-sm">Comment at this moment</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              at {formatTimestamp(timestamp)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <div className="p-4">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="What's happening at this moment?"
            maxLength={500}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/20 transition-colors"
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-[11px] text-gray-600">{text.length}/500</span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!text.trim() || submitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-30 text-sm font-semibold text-white transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              {submitting ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
