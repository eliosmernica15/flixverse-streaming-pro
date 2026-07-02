
import { useState, useEffect } from 'react';
import { Clock, Star, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import Link from 'next/link';

const PersonalizedWelcome = () => {
  const { user, isAuthenticated } = useAuth();
  const { profile } = useUserProfile();
  const [greeting, setGreeting] = useState('Welcome');
  const [timeOfDay, setTimeOfDay] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting('Good Morning');
      setTimeOfDay('morning');
    } else if (hour < 18) {
      setGreeting('Good Afternoon');
      setTimeOfDay('afternoon');
    } else {
      setGreeting('Good Evening');
      setTimeOfDay('evening');
    }
  }, []);

  const getPersonalizedMessage = () => {
    if (!isAuthenticated) {
      return 'Welcome to FlixVerse! Sign in to unlock personalized recommendations and save your favorite movies.';
    }

    const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Movie Lover';
    return `Welcome back, ${displayName}! Ready to discover your next favorite movie?`;
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 animate-fade-in-up">
      <div className="max-w-[1800px] mx-auto">
        <div className="glass-card rounded-2xl p-4 sm:p-6 border border-white/5 shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-purple-500/5 to-blue-500/10 pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 flex items-center gap-3">
                <span>{greeting}!</span>
                <Sparkles className="w-6 h-6 text-yellow-500" />
              </h1>
              <p className="text-gray-400 text-sm sm:text-base">{getPersonalizedMessage()}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {!isAuthenticated ? (
                <Link
                  href="/auth"
                  className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white px-5 py-2.5 rounded-xl transition-transform duration-200 hover:scale-105 shadow-lg shadow-red-500/20 font-semibold text-sm"
                >
                  Sign In
                </Link>
              ) : (
                <>
                  <div className="flex items-center space-x-2 glass-card px-3 py-2 rounded-xl text-sm">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span className="text-gray-300 hidden sm:inline">Personalized for you</span>
                    <span className="text-gray-300 sm:hidden">Personal</span>
                  </div>

                  <div className="flex items-center space-x-2 glass-card px-3 py-2 rounded-xl text-sm">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="text-gray-300 capitalize">{timeOfDay}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {isAuthenticated && profile && (
            <div className="relative z-10 mt-4 flex flex-wrap gap-2">
              <span className="px-3 py-1.5 bg-red-500/15 text-red-400 rounded-lg text-xs font-medium border border-red-500/20">
                Premium Member
              </span>
              <span className="px-3 py-1.5 bg-blue-500/15 text-blue-400 rounded-lg text-xs font-medium border border-blue-500/20">
                Personal Lists Available
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonalizedWelcome;
