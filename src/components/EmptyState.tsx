import Link from "next/link";
import { ReactNode } from "react";

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
    "inline-flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white px-6 py-3 rounded-xl font-semibold transition-transform duration-200 hover:scale-[1.02] shadow-lg shadow-red-500/20";

  return (
    <div className="flex flex-col items-center justify-center py-16 sm:py-20 px-4">
      <div className="glass-card p-10 sm:p-12 rounded-3xl max-w-lg w-full text-center border border-white/8">
        <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/10">
          {icon}
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
    </div>
  );
}
