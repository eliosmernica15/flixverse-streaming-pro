"use client";

import { useState, useCallback, useEffect } from "react";
import { AtSign, Check, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUserProfileContext } from "@/contexts/UserProfileContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/firebase/clientAuth";
import { normalizeUsername, validateUsername } from "@/lib/username";

export function UsernameSettings() {
  const { profile } = useUserProfileContext();
  const { user } = useAuth();
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    setValue(profile?.username ?? "");
    setAvailable(null);
  }, [profile?.username]);

  const checkAvailability = useCallback(async (raw: string) => {
    const parsed = validateUsername(raw);
    if (parsed.ok === false) {
      setAvailable(false);
      return;
    }
    if (parsed.value === profile?.username) {
      setAvailable(true);
      return;
    }
    setChecking(true);
    try {
      const res = await fetch(
        `/api/profile/username?username=${encodeURIComponent(parsed.value)}`,
        { method: "HEAD" }
      );
      setAvailable(res.status === 204);
    } catch {
      setAvailable(null);
    } finally {
      setChecking(false);
    }
  }, [profile?.username]);

  useEffect(() => {
    if (!value || value.length < 3) {
      setAvailable(null);
      return;
    }
    const t = setTimeout(() => void checkAvailability(value), 400);
    return () => clearTimeout(t);
  }, [value, checkAvailability]);

  const handleSave = async () => {
    if (!user) return;
    const parsed = validateUsername(value);
    if (parsed.ok === false) {
      toast({ title: "Invalid username", description: parsed.error, variant: "destructive" });
      return;
    }
    if (parsed.value === profile?.username) return;

    setSaving(true);
    try {
      const headers = await getAuthHeaders(user);
      const res = await fetch("/api/profile/username", {
        method: "POST",
        headers,
        body: JSON.stringify({ username: parsed.value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: "Could not save username",
          description: (data.error as string) || "Try another handle",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Username saved",
        description: `Friends can find you as @${parsed.value}`,
      });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const validation = value ? validateUsername(value) : null;
  const showError = validation && validation.ok === false && value.length > 0;

  return (
    <section className="glass-card rounded-2xl border border-white/10 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 flex items-center justify-center border border-white/10">
          <AtSign className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Username</h3>
          <p className="text-sm text-gray-500">
            Unique handle for friend search and watch-party invites
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
            {checking && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
            {!checking && available === true && validation?.ok === true && (
              <Check className="w-4 h-4 text-emerald-400" />
            )}
            {!checking && (showError || available === false) && (
              <AlertCircle className="w-4 h-4 text-red-400" />
            )}
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

        {showError && validation && validation.ok === false && (
          <p className="text-xs text-red-400">{validation.error}</p>
        )}
        {!showError && available === false && (
          <p className="text-xs text-red-400">Username is already taken</p>
        )}

        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={
            saving ||
            validation?.ok !== true ||
            available !== true ||
            value === profile?.username
          }
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
