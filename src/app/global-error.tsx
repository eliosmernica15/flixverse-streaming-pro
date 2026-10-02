"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="auth-bg bg-black text-white min-h-screen flex items-center justify-center">
        <div className="absolute inset-0 pointer-events-none">
          <div className="auth-orb auth-orb-red" />
          <div className="auth-orb auth-orb-purple" />
        </div>
        <div className="relative z-10 glass-panel rounded-3xl p-10 text-center max-w-md mx-4">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/15 text-red-400">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-gray-400 mb-6">A critical error occurred. Please reload the page.</p>
          <Button onClick={reset} variant="gradient" className="min-h-[44px] w-full">
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
        </div>
      </body>
    </html>
  );
}
