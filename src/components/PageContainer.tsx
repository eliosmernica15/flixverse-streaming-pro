import { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export default function PageContainer({ children, className = "" }: PageContainerProps) {
  return (
    <div className={`relative px-4 sm:px-6 lg:px-8 pb-16 max-w-[1800px] mx-auto ${className}`}>
      {/* Subtle ambient glow behind page content */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-64 bg-red-600/[0.03] rounded-full blur-[120px] pointer-events-none" />
      <div className="relative">{children}</div>
    </div>
  );
}
