"use client";

import { useState, useEffect } from "react";
import { Bell, Settings, ShieldCheck, AlertCircle, Mail, Smartphone, Bell as BellIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useNotifications } from "@/hooks/useNotifications";
import { pythonFetch } from "@/lib/pythonApi/client";
import { useAuth } from "@/hooks/useAuth";

interface ChannelPrefs {
  email_enabled: boolean;
  push_enabled: boolean;
  in_app_enabled: boolean;
  channel_prefs: Record<string, { email: boolean; push: boolean; in_app: boolean }>;
}

const NOTIFICATION_TYPES = [
  { key: "like", label: "Likes", icon: "❤️" },
  { key: "comment", label: "Comments", icon: "💬" },
  { key: "follow", label: "New Followers", icon: "👤" },
  { key: "review", label: "Reviews", icon: "⭐" },
  { key: "new_episode", label: "New Episodes", icon: "📺" },
  { key: "recommendation", label: "Recommendations", icon: "🎯" },
  { key: "friend_request", label: "Friend Requests", icon: "🤝" },
  { key: "friend_accepted", label: "Friend Accepted", icon: "✅" },
  { key: "watch_party_invite", label: "Watch Party Invites", icon: "🎉" },
  { key: "watch_party_invite_declined", label: "Invites Declined", icon: "❌" },
] as const;

const DEFAULT_CHANNEL_PREFS: ChannelPrefs = {
  email_enabled: true,
  push_enabled: true,
  in_app_enabled: true,
  channel_prefs: NOTIFICATION_TYPES.reduce((acc, { key }) => {
    acc[key] = { email: true, push: true, in_app: true };
    return acc;
  }, {} as Record<string, { email: boolean; push: boolean; in_app: boolean }>),
};

const NotificationSettings = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { preferences, updatePreferences, hasPermission, requestPermission } = useNotifications();
  const { isAuthenticated } = useAuth();
  const [channelPrefs, setChannelPrefs] = useState<ChannelPrefs>(DEFAULT_CHANNEL_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load channel preferences from backend
  useEffect(() => {
    if (!isAuthenticated) return;
    const loadPrefs = async () => {
      try {
        const data = await pythonFetch<ChannelPrefs>("/notifications/preferences");
        setChannelPrefs(data);
      } catch (err) {
        console.error("[NotificationSettings] Failed to load channel preferences:", err);
      } finally {
        setLoading(false);
      }
    };
    loadPrefs();
  }, [isAuthenticated]);

  // Save channel preferences to backend
  const saveChannelPrefs = async (newPrefs: Partial<ChannelPrefs>) => {
    const updated = { ...channelPrefs, ...newPrefs };
    setChannelPrefs(updated);
    setSaving(true);
    try {
      await pythonFetch("/notifications/preferences", {
        method: "PATCH",
        body: JSON.stringify(newPrefs),
      });
    } catch (err) {
      console.error("[NotificationSettings] Failed to save channel preferences:", err);
      // Revert on error
      setChannelPrefs(channelPrefs);
    } finally {
      setSaving(false);
    }
  };

  const handlePreferenceChange = async (key: keyof typeof preferences, value: boolean) => {
    if (value && key !== "allNotifications" && hasPermission === false) {
      const granted = await requestPermission();
      if (!granted) return;
    }
    if (value && key === "allNotifications" && hasPermission !== true) {
      const granted = await requestPermission();
      if (!granted) {
        updatePreferences({ allNotifications: false });
        return;
      }
    }
    updatePreferences({ [key]: value });
  };

  const handleChannelToggle = (channel: "email_enabled" | "push_enabled" | "in_app_enabled", value: boolean) => {
    saveChannelPrefs({ [channel]: value });
  };

  const handleTypeChannelToggle = (
    type: string,
    channel: "email" | "push" | "in_app",
    value: boolean
  ) => {
    const updated = {
      ...channelPrefs.channel_prefs,
      [type]: { ...channelPrefs.channel_prefs[type], [channel]: value },
    };
    saveChannelPrefs({ channel_prefs: updated });
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="relative rounded-full p-2 transition-colors hover:bg-gray-800 focus-ring"
            aria-label="Notification preferences"
          >
            <Settings className="w-5 h-5 text-gray-400" />
          </Button>
        </DialogTrigger>
        <DialogContent className="glass-strong text-white max-w-md mx-auto rounded-2xl border-white/10">
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500/30 border-t-red-500" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative rounded-full p-2 transition-colors hover:bg-gray-800 focus-ring"
          aria-label="Notification preferences"
        >
          <Settings className="w-5 h-5 text-gray-400" />
        </Button>
      </DialogTrigger>

      <DialogContent className="glass-strong text-white max-w-[36rem] mx-auto rounded-2xl border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Bell className="w-5 h-5 text-red-400" />
            Notification Preferences
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            In-app alerts (friends, watch parties) always show in the bell icon. Adjust optional browser alerts and delivery channels below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Browser Alerts Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-white/80 uppercase tracking-wide">Browser Alerts</h4>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-white">All browser alerts</label>
                <p className="text-xs text-gray-400">Optional desktop notifications for new content</p>
              </div>
              <Switch
                checked={preferences.allNotifications}
                onCheckedChange={(checked) => handlePreferenceChange("allNotifications", checked)}
              />
            </div>

            {preferences.allNotifications && (
              <div className="space-y-3 ml-4 border-l border-white/10 pl-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-white">New Movies</label>
                  <Switch
                    checked={preferences.newMovies}
                    onCheckedChange={(checked) => handlePreferenceChange("newMovies", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-white">Popular Movies</label>
                  <Switch
                    checked={preferences.popularMovies}
                    onCheckedChange={(checked) => handlePreferenceChange("popularMovies", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-white">Popular TV Shows</label>
                  <Switch
                    checked={preferences.popularTVShows}
                    onCheckedChange={(checked) => handlePreferenceChange("popularTVShows", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-white">Upcoming Content</label>
                  <Switch
                    checked={preferences.upcomingContent}
                    onCheckedChange={(checked) => handlePreferenceChange("upcomingContent", checked)}
                  />
                </div>
              </div>
            )}

            {hasPermission === false && preferences.allNotifications && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
                <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-200/90 leading-relaxed">Browser alerts are blocked. Enable notifications in your browser settings to receive desktop alerts. In-app bell alerts always work.</p>
              </div>
            )}
            {hasPermission === true && preferences.allNotifications && (
              <div className="flex items-center gap-2 rounded-xl bg-green-500/10 border border-green-500/20 p-2.5">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                <p className="text-xs text-green-200/90">Browser alerts enabled - you&apos;ll get desktop notifications for new content.</p>
              </div>
            )}
          </div>

          <div className="border-t border-white/10" />

          {/* Delivery Channels Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-white/80 uppercase tracking-wide">Delivery Channels</h4>
            <p className="text-xs text-gray-400">Choose how you receive social notifications (likes, comments, follows, party invites, etc.)</p>

            <div className="grid grid-cols-3 gap-3">
              <label className="flex flex-col items-center gap-2 rounded-xl bg-white/5 p-4 border border-white/10 transition-colors hover:border-white/20 cursor-pointer">
                <Mail className="w-6 h-6 text-white" />
                <span className="text-sm font-medium text-white">Email</span>
                <Switch
                  checked={channelPrefs.email_enabled}
                  onCheckedChange={(checked) => handleChannelToggle("email_enabled", checked)}
                  disabled={saving}
                />
              </label>
              <label className="flex flex-col items-center gap-2 rounded-xl bg-white/5 p-4 border border-white/10 transition-colors hover:border-white/20 cursor-pointer">
                <Smartphone className="w-6 h-6 text-white" />
                <span className="text-sm font-medium text-white">Push</span>
                <Switch
                  checked={channelPrefs.push_enabled}
                  onCheckedChange={(checked) => handleChannelToggle("push_enabled", checked)}
                  disabled={saving}
                />
              </label>
              <label className="flex flex-col items-center gap-2 rounded-xl bg-white/5 p-4 border border-white/10 transition-colors hover:border-white/20 cursor-pointer">
                <BellIcon className="w-6 h-6 text-white" />
                <span className="text-sm font-medium text-white">In-App</span>
                <Switch
                  checked={channelPrefs.in_app_enabled}
                  onCheckedChange={(checked) => handleChannelToggle("in_app_enabled", checked)}
                  disabled={saving}
                />
              </label>
            </div>
          </div>

          <div className="border-t border-white/10" />

          {/* Per-Type Channel Preferences */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-white/80 uppercase tracking-wide">Per-Notification Settings</h4>
            <p className="text-xs text-gray-400">Fine-tune delivery channels for each notification type</p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-2 text-xs font-medium text-gray-400 uppercase tracking-wide">Type</th>
                    <th className="text-center p-2 text-xs font-medium text-gray-400 uppercase tracking-wide w-16">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center justify-center">
                            <Mail className="w-4 h-4" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">Email</TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="text-center p-2 text-xs font-medium text-gray-400 uppercase tracking-wide w-16">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center justify-center">
                            <Smartphone className="w-4 h-4" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">Push</TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="text-center p-2 text-xs font-medium text-gray-400 uppercase tracking-wide w-16">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center justify-center">
                            <BellIcon className="w-4 h-4" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">In-App</TooltipContent>
                      </Tooltip>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {NOTIFICATION_TYPES.map(({ key, label }) => (
                    <tr key={key} className="border-b border-white/5 hover:bg-white/2.5 transition-colors">
                      <td className="p-2 text-white">{label}</td>
                      <td className="text-center p-2">
                        <Switch
                          checked={channelPrefs.channel_prefs[key]?.email ?? true}
                          onCheckedChange={(checked) => handleTypeChannelToggle(key, "email", checked)}
                          disabled={saving || !channelPrefs.email_enabled}
                        />
                      </td>
                      <td className="text-center p-2">
                        <Switch
                          checked={channelPrefs.channel_prefs[key]?.push ?? true}
                          onCheckedChange={(checked) => handleTypeChannelToggle(key, "push", checked)}
                          disabled={saving || !channelPrefs.push_enabled}
                        />
                      </td>
                      <td className="text-center p-2">
                        <Switch
                          checked={channelPrefs.channel_prefs[key]?.in_app ?? true}
                          onCheckedChange={(checked) => handleTypeChannelToggle(key, "in_app", checked)}
                          disabled={saving || !channelPrefs.in_app_enabled}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationSettings;