import { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export default function PageContainer({ children, className = "" }: PageContainerProps) {
  return (
    <div className={`px-4 sm:px-6 lg:px-8 pb-16 max-w-[1800px] mx-auto ${className}`}>
      {children}
    </div>
  );
}
