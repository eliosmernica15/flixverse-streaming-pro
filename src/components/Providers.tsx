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
import { ChunkReloadBoundary } from "@/components/ChunkReloadBoundary";

const CommandPalette = dynamic(() => import("@/components/CommandPalette"), { ssr: false });
const KeyboardShortcutsHelp = dynamic(() => import("@/components/KeyboardShortcutsHelp"), {
  ssr: false,
});
const ServiceWorkerRegister = dynamic(() => import("@/components/ServiceWorkerRegister"), {
  ssr: false,
});
const InstallPrompt = dynamic(() => import("@/components/InstallPrompt"), { ssr: false });
const OfflineBanner = dynamic(() => import("@/components/OfflineBanner"), { ssr: false });
const BackToTop = dynamic(() => import("@/components/BackToTop"), { ssr: false });
const OfflineCacheSync = dynamic(() => import("@/components/OfflineCacheSync"), { ssr: false });
const CookieConsent = dynamic(
  () => import("@/components/CookieConsent").then((module) => module.CookieConsent),
  { ssr: false }
);
const UsernameReminder = dynamic(() => import("@/components/UsernameReminder"), { ssr: false });
const InviteAlertListener = dynamic(() => import("@/components/InviteAlertListener"), {
  ssr: false,
});
const GuestJoinOverlay = dynamic(() => import("@/components/party/GuestJoinOverlay"), {
  ssr: false,
});
import { OfflineSyncProvider } from "@/components/offline/OfflineSyncProvider";
import { ExperimentProvider } from "@/contexts/ExperimentContext";
import { IntlProvider } from "@/components/IntlProvider";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";

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
            <IntlProvider>
            <AnalyticsProvider>
            <AuthProvider>
                <UserProfileProvider>
                <UserMovieListProvider>
                <WatchHistoryProvider>
                <UserPreferencesProvider>
                <OfflineSyncProvider>
                <ExperimentProvider>
                <TooltipProvider>
                    <ChunkReloadBoundary />
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
                    <UsernameReminder />
                    <InviteAlertListener />
                    <GuestJoinOverlay />
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
            </AnalyticsProvider>
            </IntlProvider>
        </QueryClientProvider>
    );
}
