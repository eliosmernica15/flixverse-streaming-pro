
import { useState } from 'react';
import { Bell, BellOff, Settings, TestTube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useNotifications } from '@/hooks/useNotifications';

const NotificationSettings = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { hasPermission, preferences, requestPermission, updatePreferences, sendTestNotification } = useNotifications();

  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    if (granted) {
      updatePreferences({ allNotifications: true });
    }
  };

  const handlePreferenceChange = (key: keyof typeof preferences, value: boolean) => {
    updatePreferences({ [key]: value });
  };

  const handleTestNotification = () => {
    if (hasPermission && preferences.allNotifications) {
      sendTestNotification();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="p-2 hover:bg-gray-800 rounded-full transition-colors relative"
        >
          {hasPermission && preferences.allNotifications ? (
            <Bell className="w-5 h-5" />
          ) : (
            <BellOff className="w-5 h-5" />
          )}
          {!hasPermission && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full"></span>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Notification Settings
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Choose what notifications you'd like to receive about new content
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!hasPermission ? (
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white">Enable Notifications</CardTitle>
                <CardDescription className="text-gray-400">
                  Get notified about new movies, TV shows, and trending content
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={handleEnableNotifications}
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                >
                  <Bell className="w-4 h-4 mr-2" />
                  Allow Notifications
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-white">
                    All Notifications
                  </label>
                  <p className="text-xs text-gray-400">
                    Master switch for all notifications
                  </p>
                </div>
                <Switch
                  checked={preferences.allNotifications}
                  onCheckedChange={(checked) => handlePreferenceChange('allNotifications', checked)}
                />
              </div>

              {preferences.allNotifications && (
                <div className="space-y-3 ml-4 border-l border-gray-700 pl-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm text-white">New Movies</label>
                      <p className="text-xs text-gray-400">Latest movie releases</p>
                    </div>
                    <Switch
                      checked={preferences.newMovies}
                      onCheckedChange={(checked) => handlePreferenceChange('newMovies', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm text-white">Popular Movies</label>
                      <p className="text-xs text-gray-400">Trending movie content</p>
                    </div>
                    <Switch
                      checked={preferences.popularMovies}
                      onCheckedChange={(checked) => handlePreferenceChange('popularMovies', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm text-white">Popular TV Shows</label>
                      <p className="text-xs text-gray-400">Trending TV series</p>
                    </div>
                    <Switch
                      checked={preferences.popularTVShows}
                      onCheckedChange={(checked) => handlePreferenceChange('popularTVShows', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm text-white">Upcoming Content</label>
                      <p className="text-xs text-gray-400">Soon-to-be-released content</p>
                    </div>
                    <Switch
                      checked={preferences.upcomingContent}
                      onCheckedChange={(checked) => handlePreferenceChange('upcomingContent', checked)}
                    />
                  </div>
                </div>
              )}

              {preferences.allNotifications && (
                <div className="pt-4 border-t border-gray-700">
                  <Button
                    onClick={handleTestNotification}
                    variant="outline"
                    className="w-full border-gray-600 text-gray-300 hover:bg-gray-800"
                  >
                    <TestTube className="w-4 h-4 mr-2" />
                    Send Test Notification
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationSettings;
