"use client";

import dynamic from "next/dynamic";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserProfileProvider } from "@/contexts/UserProfileContext";
import { UserMovieListProvider } from "@/contexts/UserMovieListContext";
import { WatchHistoryProvider } from "@/contexts/WatchHistoryContext";
import { UserPreferencesProvider } from "@/contexts/UserPreferencesContext";
import RouteProgress from "@/components/RouteProgress";
import GlobalShortcuts from "@/components/GlobalShortcuts";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import InstallPrompt from "@/components/InstallPrompt";
import OfflineBanner from "@/components/OfflineBanner";
import BackToTop from "@/components/BackToTop";
import OfflineCacheSync from "@/components/OfflineCacheSync";
import { CookieConsent } from "@/components/CookieConsent";

const CommandPalette = dynamic(() => import("@/components/CommandPalette"), { ssr: false });
const KeyboardShortcutsHelp = dynamic(() => import("@/components/KeyboardShortcutsHelp"), {
  ssr: false,
});
import { OfflineSyncProvider } from "@/components/offline/OfflineSyncProvider";
import { ExperimentProvider } from "@/contexts/ExperimentContext";

export default function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 10 * 60 * 1000,
                        gcTime: 30 * 60 * 1000,
                        refetchOnWindowFocus: false,
                        refetchOnReconnect: false,
                        retry: 1,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <UserProfileProvider>
                <UserMovieListProvider>
                <WatchHistoryProvider>
                <UserPreferencesProvider>
                <OfflineSyncProvider>
                <ExperimentProvider>
                <TooltipProvider>
                    <RouteProgress />
                    <GlobalShortcuts />
                    <CommandPalette />
                    <KeyboardShortcutsHelp />
                    <OfflineCacheSync />
                    <ServiceWorkerRegister />
                    <OfflineBanner />
                    <InstallPrompt />
                    <BackToTop />
                    <CookieConsent />
                    {children}
                    <Toaster />
                    <Sonner />
                </TooltipProvider>
                </ExperimentProvider>
                </OfflineSyncProvider>
                </UserPreferencesProvider>
                </WatchHistoryProvider>
                </UserMovieListProvider>
                </UserProfileProvider>
            </AuthProvider>
        </QueryClientProvider>
    );
}
