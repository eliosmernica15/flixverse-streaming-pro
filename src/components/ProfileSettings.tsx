"use client";

import { Bell, Globe, Sparkles, Trash2, Palette, Shield, CreditCard, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useUserPreferencesContext } from "@/contexts/UserPreferencesContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useSyncedCaptionPreferences } from "@/hooks/player/useSyncedCaptionPreferences";

interface ProfileSettingsProps {
  onOpenTab?: (tab: string) => void;
}

export default function ProfileSettings({ onOpenTab }: ProfileSettingsProps) {
  const { preferences, updatePreferences } = useUserPreferencesContext();
  const { preferences: notifPrefs, updatePreferences: updateNotif } = useNotifications();
  const { toast } = useToast();

  const { spoilerGuard, setSpoilerGuard } = useSyncedCaptionPreferences();

  // Ambient glow toggle (persisted in localStorage)
  const [ambientGlow, setAmbientGlow] = useState(true);

  useEffect(() => {
    try {
      setAmbientGlow(localStorage.getItem("flixverse-ambient-glow") !== "false");
    } catch {}
  }, []);

  const toggleAmbientGlow = (checked: boolean) => {
    setAmbientGlow(checked);
    localStorage.setItem("flixverse-ambient-glow", String(checked));
    window.dispatchEvent(new CustomEvent("toggle-ambient-glow", { detail: { enabled: checked } }));
    toast({ title: checked ? "Ambient glow on" : "Ambient glow off" });
  };

  const toggleSpoilerGuard = (checked: boolean) => {
    setSpoilerGuard(checked);
    toast({ title: checked ? "Spoiler guard on" : "Spoiler guard off" });
  };

  const languages = [
    { code: "en", label: "English" },
    { code: "es", label: "Español" },
    { code: "fr", label: "Français" },
    { code: "de", label: "Deutsch" },
  ];

  const clearLocalData = () => {
    localStorage.removeItem("userPreferences");
    localStorage.removeItem("myMovieList");
    updatePreferences({
      favoriteGenres: [],
      watchedMovies: [],
      viewHistory: [],
      preferredLanguage: "en",
      personalizedRecommendations: true,
      lastVisited: new Date().toISOString(),
    });
    toast({ title: "Local data cleared", description: "Preferences and cached list data were reset." });
  };

  return (
    <div className="space-y-6 animate-fade-in">

      <section className="glass-card rounded-2xl border border-white/10 p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center border border-white/10">
              <CreditCard className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Subscription</h3>
              <p className="text-sm text-gray-500">Plan, renewal, and payment methods</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-white/10 text-gray-300 shrink-0"
            onClick={() => onOpenTab?.("billing")}
          >
            Billing
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </section>

      <section className="glass-card rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/10 flex items-center justify-center border border-white/10">
            <Sparkles className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Playback & discovery</h3>
            <p className="text-sm text-gray-500">Personalize how FlixVerse recommends content</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
            <div>
              <p className="text-sm font-medium text-white">Personalized recommendations</p>
              <p className="text-xs text-gray-500 mt-0.5">Use your watch history and genres you explore</p>
            </div>
            <Switch
              checked={preferences.personalizedRecommendations}
              onCheckedChange={(checked) => {
                updatePreferences({ personalizedRecommendations: checked });
                toast({ title: checked ? "Recommendations on" : "Recommendations off" });
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-3">
              <Palette className="w-4 h-4 text-purple-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">Ambient glow</p>
                <p className="text-xs text-gray-500 mt-0.5">Dynamic backlight effect during playback</p>
              </div>
            </div>
            <Switch checked={ambientGlow} onCheckedChange={toggleAmbientGlow} />
          </div>

          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">Spoiler guard</p>
                <p className="text-xs text-gray-500 mt-0.5">Hide episodes you haven&apos;t watched yet</p>
              </div>
            </div>
            <Switch checked={spoilerGuard} onCheckedChange={toggleSpoilerGuard} />
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/5">
            <label className="flex items-center gap-2 text-sm font-medium text-white mb-2">
              <Globe className="w-4 h-4 text-gray-400" />
              Preferred language
            </label>
              <select
                value={preferences.preferredLanguage}
                onChange={(e) => updatePreferences({ preferredLanguage: e.target.value })}
                className="focus-ring input-field w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white"
              >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-zinc-900">
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {preferences.favoriteGenres.length > 0 && (
            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
              <p className="text-sm font-medium text-white mb-2">Favorite genres</p>
              <div className="flex flex-wrap gap-2">
                {preferences.favoriteGenres.map((genre) => (
                  <span
                    key={genre}
                    className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-300 border border-red-500/20"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="glass-card rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/10 flex items-center justify-center border border-white/10">
            <Bell className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Notifications</h3>
            <p className="text-sm text-gray-500">Alerts for new and trending content</p>
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          Friend requests and watch party invites always appear in the bell icon. Toggles below are for optional browser alerts only.
        </p>
        <div className="space-y-3">
          {(
            [
              ["allNotifications", "All browser alerts"],
              ["newMovies", "New movies"],
              ["popularMovies", "Popular movies"],
              ["popularTVShows", "Popular TV shows"],
              ["upcomingContent", "Upcoming content"],
            ] as const
          ).map(([key, label]) => (
            <div
              key={key}
              className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5"
            >
              <span className="text-sm text-gray-200">{label}</span>
              <Switch
                checked={notifPrefs[key]}
                onCheckedChange={(checked) => updateNotif({ [key]: checked })}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="glass-card rounded-2xl border border-white/10 p-6">
        <h3 className="text-lg font-bold text-white mb-2">Data & privacy</h3>
        <p className="text-sm text-gray-500 mb-4">
          Clear locally stored preferences and guest watchlist cache on this device.
        </p>
          <Button
            variant="outline"
            onClick={clearLocalData}
            className="border-white/10 text-gray-300 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300 focus-ring"
          >
          <Trash2 className="w-4 h-4 mr-2" />
          Clear local data
        </Button>
      </section>
    </div>
  );
}
