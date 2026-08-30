"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import Navigation from "@/components/Navigation";

const Footer = dynamic(() => import("@/components/Footer"), {
  ssr: false,
  loading: () => null,
});

const SHELL_HIDDEN_PREFIXES = ["/auth", "/movie/"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tc = useTranslations("common");
  const hideShell = SHELL_HIDDEN_PREFIXES.some((prefix) => pathname?.startsWith(prefix));

  if (hideShell) {
    return <>{children}</>;
  }

  return (
    <div className="safe-area-top flex min-h-screen flex-col overflow-x-hidden bg-[#0a0a0c] text-white">
      <a href="#main-content" className="skip-link">
        {tc("skipToContent")}
      </a>
      <a href="#search-input" className="skip-link">
        {tc("skipToSearch")}
      </a>
      <Navigation />
      <main
        id="main-content"
        className="scrollbar-thin flex-1 outline-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="page-enter mx-auto w-full max-w-[1800px]">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
