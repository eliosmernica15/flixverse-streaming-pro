import Link from "next/link";
import { ReactNode } from "react";
import Reveal from "./Reveal";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  const actionClass =
    "inline-flex items-center justify-center gap-2 min-h-[44px] bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white px-6 py-3 rounded-xl font-semibold transition-transform duration-200 hover:scale-[1.02] shadow-lg shadow-red-500/20 focus-ring";

  return (
    <Reveal className="flex flex-col items-center justify-center py-16 sm:py-20 px-4">
      <div className="glass-panel p-10 sm:p-12 rounded-3xl max-w-lg w-full text-center border border-white/8 shadow-2xl shadow-black/40">
        <div className="w-20 h-20 bg-gradient-to-br from-red-500/15 to-purple-500/15 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/10">
          <span className="gradient-text">{icon}</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">{title}</h2>
        <p className="text-gray-400 mb-8 leading-relaxed text-sm sm:text-base">{description}</p>
        {actionLabel && actionHref && (
          <Link href={actionHref} className={actionClass}>
            {actionLabel}
          </Link>
        )}
        {actionLabel && onAction && !actionHref && (
          <button type="button" onClick={onAction} className={actionClass}>
            {actionLabel}
          </button>
        )}
      </div>
    </Reveal>
  );
}
