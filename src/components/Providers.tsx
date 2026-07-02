"use client";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserProfileProvider } from "@/contexts/UserProfileContext";
import { UserMovieListProvider } from "@/contexts/UserMovieListContext";
import RouteProgress from "@/components/RouteProgress";

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
                <TooltipProvider>
                    <RouteProgress />
                    {children}
                    <Toaster />
                    <Sonner />
                </TooltipProvider>
                </UserMovieListProvider>
                </UserProfileProvider>
            </AuthProvider>
        </QueryClientProvider>
    );
}
