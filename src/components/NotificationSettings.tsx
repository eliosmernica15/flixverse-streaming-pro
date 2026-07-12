
import { useState } from 'react';
import { Bell, Settings, TestTube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useNotifications } from '@/hooks/useNotifications';

const NotificationSettings = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { preferences, updatePreferences, sendTestNotification } = useNotifications();

  const handlePreferenceChange = (key: keyof typeof preferences, value: boolean) => {
    updatePreferences({ [key]: value });
  };

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
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Bell className="w-5 h-5 text-red-400" />
            Notification Preferences
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            In-app alerts (friends, watch parties) always show in the bell icon. Adjust optional browser alerts below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-white">All browser alerts</label>
              <p className="text-xs text-gray-400">Optional desktop notifications for new content</p>
            </div>
            <Switch
              checked={preferences.allNotifications}
              onCheckedChange={(checked) => handlePreferenceChange('allNotifications', checked)}
            />
          </div>

          {preferences.allNotifications && (
            <div className="space-y-3 ml-4 border-l border-white/10 pl-4">
              <div className="flex items-center justify-between">
                <label className="text-sm text-white">New Movies</label>
                <Switch
                  checked={preferences.newMovies}
                  onCheckedChange={(checked) => handlePreferenceChange('newMovies', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-white">Popular Movies</label>
                <Switch
                  checked={preferences.popularMovies}
                  onCheckedChange={(checked) => handlePreferenceChange('popularMovies', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-white">Popular TV Shows</label>
                <Switch
                  checked={preferences.popularTVShows}
                  onCheckedChange={(checked) => handlePreferenceChange('popularTVShows', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-white">Upcoming Content</label>
                <Switch
                  checked={preferences.upcomingContent}
                  onCheckedChange={(checked) => handlePreferenceChange('upcomingContent', checked)}
                />
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-white/10">
            <Button
              onClick={sendTestNotification}
              variant="outline"
              className="w-full border-white/10 text-gray-300 hover:bg-white/10 focus-ring"
            >
              <TestTube className="w-4 h-4 mr-2" />
              Test browser notification
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationSettings;
