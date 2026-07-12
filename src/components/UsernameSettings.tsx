"use client";

import { useState, useCallback, useEffect } from "react";
import { AtSign, Check, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUserProfileContext } from "@/contexts/UserProfileContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getFirebaseDb } from "@/integrations/firebase/client";
import { getAuthHeaders } from "@/lib/firebase/clientAuth";
import { normalizeUsername, validateUsername } from "@/lib/username";
import { checkUsernameAvailability } from "@/lib/username/claimUsername";
import { hasUsername } from "@/lib/username/resolveUsername";
import { clearUsernameReminderDismiss } from "@/lib/username/reminder";

interface UsernameSettingsProps {
  /** When true, hide after user already has a username (for global reminders only). */
  compact?: boolean;
}

type AvailabilityState = "idle" | "checking" | "available" | "taken" | "invalid" | "unknown";

export function UsernameSettings({ compact = false }: UsernameSettingsProps) {
  const { profile, updateProfile } = useUserProfileContext();
  const { user } = useAuth();
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityState>("idle");
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  useEffect(() => {
    setValue(profile?.username ?? "");
    setAvailability(profile?.username ? "available" : "idle");
    setAvailabilityError(null);
  }, [profile?.username]);

  const checkAvailability = useCallback(
    async (raw: string) => {
      const parsed = validateUsername(raw);
      if (parsed.ok === false) {
        setAvailability("invalid");
        setAvailabilityError(parsed.error);
        return;
      }

      if (parsed.value === profile?.username) {
        setAvailability("available");
        setAvailabilityError(null);
        return;
      }

      if (!user) {
        setAvailability("idle");
        return;
      }

      const db = getFirebaseDb();
      if (!db) {
        setAvailability("unknown");
        setAvailabilityError(null);
        return;
      }

      setAvailability("checking");
      setAvailabilityError(null);

      try {
        const result = await checkUsernameAvailability(db, parsed.value, user.uid);
        if (result === "available" || result === "owned") {
          setAvailability("available");
          setAvailabilityError(null);
        } else if (result === "taken") {
          setAvailability("taken");
        } else {
          setAvailability("unknown");
        }
      } catch (err) {
        const code = (err as { code?: string })?.code;
        if (code === "permission-denied") {
          setAvailability("unknown");
          setAvailabilityError("Live check unavailable — you can still try to claim.");
        } else {
          setAvailability("unknown");
          setAvailabilityError(null);
        }
      }
    },
    [profile?.username, user]
  );

  useEffect(() => {
    if (!user) return;
    if (!value || value.length < 3) {
      setAvailability(value && value === profile?.username ? "available" : "idle");
      setAvailabilityError(null);
      return;
    }
    const t = setTimeout(() => void checkAvailability(value), 400);
    return () => clearTimeout(t);
  }, [value, checkAvailability, profile?.username, user]);

  const handleSave = async () => {
    if (!user || !profile) return;
    const parsed = validateUsername(value);
    if (parsed.ok === false) {
      toast({ title: "Invalid username", description: parsed.error, variant: "destructive" });
      return;
    }
    if (parsed.value === profile.username) return;

    setSaving(true);
    try {
      const headers = await getAuthHeaders(user);
      const res = await fetch("/api/profile/username", {
        method: "POST",
        headers,
        body: JSON.stringify({ username: parsed.value }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        username?: string;
        error?: string;
      };

      if (!res.ok) {
        toast({
          title: "Could not save username",
          description: data.error || "Please try again.",
          variant: "destructive",
        });
        if (res.status === 409) setAvailability("taken");
        return;
      }

      const saved = data.username ?? parsed.value;
      await updateProfile({ username: saved });
      setAvailability("available");
      setAvailabilityError(null);
      clearUsernameReminderDismiss();
      toast({
        title: "Username saved",
        description: `Friends can find you as @${saved}`,
      });
    } catch {
      toast({ title: "Could not save username", description: "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const validation = value ? validateUsername(value) : null;
  const isUnchanged = value === profile?.username;
  const canSave =
    validation?.ok === true &&
    availability !== "taken" &&
    availability !== "invalid" &&
    !isUnchanged &&
    !saving &&
    Boolean(user);

  if (compact && hasUsername(profile)) {
    return null;
  }

  return (
    <section
      id="username-setup"
      className={
        compact
          ? "rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5"
          : "glass-card rounded-2xl border border-white/10 p-6"
      }
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 flex items-center justify-center border border-white/10">
          <AtSign className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">
            {profile?.username ? "Your username" : "Choose a username"}
          </h3>
          <p className="text-sm text-gray-500">
            {profile?.username
              ? "Friends can find you and invite you to watch parties"
              : "Required for friend search and watch-party invites"}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">@</span>
          <Input
            value={value}
            onChange={(e) => setValue(normalizeUsername(e.target.value))}
            placeholder="your_handle"
            maxLength={20}
            className="bg-white/5 border-white/10 text-white pl-8 pr-10"
            aria-describedby="username-hint"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {availability === "checking" ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
            ) : availability === "available" && validation?.ok === true ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : availability === "invalid" || availability === "taken" ? (
              <AlertCircle className="w-4 h-4 text-red-400" />
            ) : null}
          </div>
        </div>

        <p id="username-hint" className="text-xs text-gray-500">
          {profile?.display_name && (
            <span className="text-gray-400">
              Display name: <strong className="text-gray-300">{profile.display_name}</strong>
              {" · "}
            </span>
          )}
          3–20 characters · letters, numbers, underscores
        </p>

        {availability === "invalid" && availabilityError && (
          <p className="text-xs text-red-400">{availabilityError}</p>
        )}
        {availability === "taken" && (
          <p className="text-xs text-red-400">Username is already taken — try another handle</p>
        )}
        {availability === "unknown" && availabilityError && (
          <p className="text-xs text-amber-400">{availabilityError}</p>
        )}

        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave}
          className="bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving…
            </>
          ) : profile?.username ? (
            "Update username"
          ) : (
            "Claim username"
          )}
        </Button>
      </div>
    </section>
  );
}
