import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, Settings, Film, Tv, Star, Heart, Clock, 
  Calendar, Edit2, Camera, LogOut, ChevronRight,
  MessageCircle, TrendingUp, Award, Filter
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserMovieList } from '@/hooks/useUserMovieList';
import { useWatchHistory } from '@/hooks/useWatchHistory';
import { useUserActivity, ActivityType } from '@/hooks/useUserActivity';
import { useToast } from '@/hooks/use-toast';
import Navigation from '@/components/Navigation';
import { ActivityFeed } from '@/components/ActivityItem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';
import { getImageUrl } from '@/utils/tmdbApi';

const Profile = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading, signOut } = useAuth();
  const { profile, loading: profileLoading, updateProfile } = useUserProfile();
  const { movieList, loading: listLoading } = useUserMovieList();
  const { history, getRecentlyWatched, getContinueWatching } = useWatchHistory();
  const { activities, loading: activityLoading, getActivitiesByType, getStats } = useUserActivity();
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedBio, setEditedBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [activityFilter, setActivityFilter] = useState<ActivityType | 'all'>('all');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (profile) {
      setEditedName(profile.display_name || '');
      setEditedBio(profile.bio || '');
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateProfile({
        display_name: editedName,
        bio: editedBio
      });
      setIsEditing(false);
      toast({
        title: "Profile updated",
        description: "Your profile has been saved successfully"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive"
      });
    }
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !profile) {
    return null;
  }

  const recentlyWatched = getRecentlyWatched();
  const continueWatching = getContinueWatching();
  const moviesCount = movieList.filter(m => m.media_type === 'movie').length;
  const tvCount = movieList.filter(m => m.media_type === 'tv').length;

  const stats = [
    { icon: Heart, label: 'Watchlist', value: movieList.length, color: 'text-red-400' },
    { icon: Film, label: 'Movies', value: moviesCount, color: 'text-blue-400' },
    { icon: Tv, label: 'TV Shows', value: tvCount, color: 'text-purple-400' },
    { icon: Clock, label: 'Watched', value: recentlyWatched.length, color: 'text-green-400' }
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />
      
      <main className="pt-20 pb-16">
        {/* Profile Header */}
        <div className="relative">
          {/* Cover Image */}
          <div className="h-48 md:h-64 bg-gradient-to-r from-red-900/50 via-purple-900/50 to-blue-900/50 relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1489599735161-8f4b80604bb9?w=1920')] bg-cover bg-center opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
          </div>

          {/* Profile Info */}
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative -mt-16 sm:-mt-20 flex flex-col sm:flex-row items-center sm:items-end space-y-4 sm:space-y-0 sm:space-x-6">
              {/* Avatar */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative"
              >
                <Avatar className="w-28 h-28 sm:w-36 sm:h-36 border-4 border-black shadow-2xl">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-red-500 to-orange-500 text-3xl font-bold">
                    {profile.display_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <button className="absolute bottom-1 right-1 p-2 bg-gray-800 rounded-full border border-white/20 hover:bg-gray-700 transition-colors">
                  <Camera className="w-4 h-4" />
                </button>
              </motion.div>

              {/* Name & Actions */}
              <div className="flex-1 text-center sm:text-left pb-4">
                <AnimatePresence mode="wait">
                  {isEditing ? (
                    <motion.div
                      key="editing"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      <Input
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        placeholder="Display name"
                        className="bg-white/10 border-white/20 text-white max-w-xs"
                      />
                      <Textarea
                        value={editedBio}
                        onChange={(e) => setEditedBio(e.target.value)}
                        placeholder="Write a short bio..."
                        className="bg-white/10 border-white/20 text-white max-w-md resize-none"
                        rows={2}
                      />
                      <div className="flex items-center space-x-2">
                        <Button
                          onClick={handleSaveProfile}
                          disabled={saving}
                          size="sm"
                          className="bg-red-500 hover:bg-red-600"
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </Button>
                        <Button
                          onClick={() => setIsEditing(false)}
                          variant="outline"
                          size="sm"
                          className="border-white/20"
                        >
                          Cancel
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="display"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <h1 className="text-2xl sm:text-3xl font-bold mb-1">
                        {profile.display_name || user?.email?.split('@')[0]}
                      </h1>
                      <p className="text-gray-400 mb-2">{user?.email}</p>
                      {profile.bio && (
                        <p className="text-gray-300 text-sm max-w-md">{profile.bio}</p>
                      )}
                      <p className="text-gray-500 text-xs mt-2 flex items-center justify-center sm:justify-start space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>Joined {new Date(profile.created_at).toLocaleDateString()}</span>
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                {!isEditing && (
                  <Button
                    onClick={() => setIsEditing(true)}
                    variant="outline"
                    size="sm"
                    className="border-white/20 hover:bg-white/10"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                )}
                <Button
                  onClick={handleSignOut}
                  variant="outline"
                  size="sm"
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 text-center"
                >
                  <stat.icon className={`w-6 h-6 mx-auto mb-2 ${stat.color}`} />
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-sm text-gray-400">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs Content */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <Tabs defaultValue="watchlist" className="w-full">
            <TabsList className="bg-white/5 border border-white/10 p-1 rounded-xl mb-6">
              <TabsTrigger value="watchlist" className="data-[state=active]:bg-red-500 rounded-lg">
                <Heart className="w-4 h-4 mr-2" />
                Watchlist
              </TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-red-500 rounded-lg">
                <Clock className="w-4 h-4 mr-2" />
                History
              </TabsTrigger>
              <TabsTrigger value="activity" className="data-[state=active]:bg-red-500 rounded-lg">
                <TrendingUp className="w-4 h-4 mr-2" />
                Activity
              </TabsTrigger>
            </TabsList>

            {/* Watchlist Tab */}
            <TabsContent value="watchlist">
              {movieList.length === 0 ? (
                <div className="text-center py-12">
                  <Heart className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Your watchlist is empty</p>
                  <Button
                    onClick={() => navigate('/')}
                    className="mt-4 bg-red-500 hover:bg-red-600"
                  >
                    Browse Content
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {movieList.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.03 }}
                      className="group cursor-pointer"
                      onClick={() => navigate(`/movie/${item.movie_id}?type=${item.media_type || 'movie'}`)}
                    >
                      <div className="aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 relative">
                        <img
                          src={item.movie_poster_path ? getImageUrl(item.movie_poster_path) : '/placeholder.svg'}
                          alt={item.movie_title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                          <p className="text-white text-xs font-medium truncate">{item.movie_title}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history">
              {recentlyWatched.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No watch history yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentlyWatched.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center space-x-4 bg-white/5 rounded-xl p-3 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                      onClick={() => navigate(`/movie/${item.content_id}?type=${item.content_type}`)}
                    >
                      <img
                        src={item.content_poster_path ? getImageUrl(item.content_poster_path) : '/placeholder.svg'}
                        alt={item.content_title}
                        className="w-12 h-18 object-cover rounded-lg"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{item.content_title}</p>
                        {item.season && item.episode && (
                          <p className="text-gray-400 text-sm">Season {item.season}, Episode {item.episode}</p>
                        )}
                        <p className="text-gray-500 text-xs">
                          {new Date(item.watched_at).toLocaleDateString()}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-500" />
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity">
              {/* Activity Filter */}
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <span className="text-sm text-gray-400 mr-2">Filter:</span>
                {(['all', 'review', 'rating', 'comment', 'watchlist', 'watched'] as const).map((filter) => (
                  <motion.button
                    key={filter}
                    onClick={() => setActivityFilter(filter)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      activityFilter === filter
                        ? 'bg-red-500 text-white'
                        : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </motion.button>
                ))}
              </div>

              {/* Activity Stats */}
              <motion.div 
                className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {[
                  { label: 'Reviews', value: getStats().totalReviews, icon: MessageCircle, color: 'text-purple-400' },
                  { label: 'Ratings', value: getStats().totalRatings, icon: Star, color: 'text-yellow-400' },
                  { label: 'Comments', value: getStats().totalComments, icon: MessageCircle, color: 'text-blue-400' },
                  { label: 'Watched', value: getStats().totalWatched, icon: Award, color: 'text-green-400' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white/5 rounded-lg p-3 border border-white/10 text-center">
                    <stat.icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
                    <p className="text-xl font-bold text-white">{stat.value}</p>
                    <p className="text-xs text-gray-500">{stat.label}</p>
                  </div>
                ))}
              </motion.div>

              {/* Activity Feed */}
              <ActivityFeed 
                activities={activityFilter === 'all' ? activities : getActivitiesByType(activityFilter)}
                loading={activityLoading}
                emptyMessage={
                  activityFilter === 'all' 
                    ? "Your activity feed will appear here" 
                    : `No ${activityFilter} activity yet`
                }
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Profile;
