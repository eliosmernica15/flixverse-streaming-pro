"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AtSign, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfileContext } from "@/contexts/UserProfileContext";
import { Button } from "@/components/ui/button";
import { hasUsername } from "@/lib/username/resolveUsername";
import {
  clearUsernameReminderDismiss,
  dismissUsernameReminder,
  isUsernameReminderDismissed,
} from "@/lib/username/reminder";

export default function UsernameReminder() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useUserProfileContext();
  const pathname = usePathname();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (authLoading || profileLoading || !isAuthenticated || !profile) {
      setVisible(false);
      return;
    }

    if (hasUsername(profile)) {
      clearUsernameReminderDismiss();
      setVisible(false);
      return;
    }

    if (pathname?.startsWith("/auth") || pathname?.startsWith("/movie/")) {
      setVisible(false);
      return;
    }

    if (isUsernameReminderDismissed()) {
      setVisible(false);
      return;
    }

    const timer = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(timer);
  }, [authLoading, profileLoading, isAuthenticated, profile, pathname]);

  const dismiss = () => {
    dismissUsernameReminder();
    setVisible(false);
  };

  const goToProfile = () => {
    dismiss();
    router.push("/profile?setup=username");
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        role="dialog"
        aria-labelledby="username-reminder-title"
        className="glass-strong relative w-full max-w-md rounded-2xl border border-emerald-500/25 bg-zinc-950/95 p-6 shadow-2xl shadow-black/50"
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/20">
          <AtSign className="h-6 w-6 text-emerald-400" />
        </div>

        <h2 id="username-reminder-title" className="mb-2 text-lg font-bold text-white">
          Pick a username
        </h2>
        <p className="mb-6 text-sm leading-relaxed text-gray-400">
          Choose a unique handle so friends can find you, send invites, and join your watch parties.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            onClick={goToProfile}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            Set up username
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={dismiss}
            className="flex-1 border-white/10 text-gray-300 hover:bg-white/5"
          >
            Later
          </Button>
        </div>
      </div>
    </div>
  );
}
