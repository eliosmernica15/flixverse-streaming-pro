"use client";

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
                <TooltipProvider>
                    <RouteProgress />
                    <GlobalShortcuts />
                    {children}
                    <Toaster />
                    <Sonner />
                </TooltipProvider>
                </UserPreferencesProvider>
                </WatchHistoryProvider>
                </UserMovieListProvider>
                </UserProfileProvider>
            </AuthProvider>
        </QueryClientProvider>
    );
}
