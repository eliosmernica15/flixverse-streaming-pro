import { ReactNode } from "react";

type Accent = "red" | "purple" | "orange" | "rose" | "amber";

const accentStyles: Record<Accent, { gradient: string; icon: string; glow: string }> = {
  red: {
    gradient: "from-red-900/20",
    icon: "from-red-500 to-red-600",
    glow: "bg-red-500/8",
  },
  purple: {
    gradient: "from-purple-900/20",
    icon: "from-purple-500 to-purple-600",
    glow: "bg-purple-500/8",
  },
  orange: {
    gradient: "from-orange-900/20",
    icon: "from-orange-500 to-red-600",
    glow: "bg-orange-500/8",
  },
  rose: {
    gradient: "from-rose-900/20",
    icon: "from-rose-500 to-red-600",
    glow: "bg-rose-500/8",
  },
  amber: {
    gradient: "from-amber-900/15",
    icon: "from-amber-500 to-orange-600",
    glow: "bg-amber-500/8",
  },
};

interface PageHeroProps {
  title: string;
  subtitle: string;
  icon: ReactNode;
  accent?: Accent;
  meta?: string;
}

export default function PageHero({ title, subtitle, icon, accent = "red", meta }: PageHeroProps) {
  const styles = accentStyles[accent];

  return (
    <header className="relative pt-20 pb-8 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-b ${styles.gradient} via-transparent to-transparent pointer-events-none`} />
      <div className={`absolute top-16 left-1/4 w-72 h-72 ${styles.glow} rounded-full blur-3xl pointer-events-none`} />

      <div className="relative z-10 max-w-[1800px] mx-auto">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br ${styles.icon} rounded-2xl flex items-center justify-center shadow-lg shadow-black/30 shrink-0`}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight truncate">
              {title}
            </h1>
            <p className="text-gray-400 text-sm sm:text-base mt-1">{subtitle}</p>
            {meta && <p className="text-gray-500 text-xs sm:text-sm mt-0.5">{meta}</p>}
          </div>
        </div>
      </div>
    </header>
  );
}
