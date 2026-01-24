
import { useState, useEffect } from 'react';
import { Clock, Heart, TrendingUp, Star } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Link } from 'react-router-dom';

const PersonalizedWelcome = () => {
  const { user, isAuthenticated } = useAuth();
  const { profile } = useUserProfile();
  const [greeting, setGreeting] = useState('');
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
      return `Welcome to FlixVerse! Sign in to unlock personalized recommendations and save your favorite movies.`;
    }
    
    const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Movie Lover';
    return `Welcome back, ${displayName}! Ready to discover your next favorite movie?`;
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 mb-8 animate-fade-in">
      <div className="bg-gradient-to-r from-red-900/40 via-purple-900/30 to-blue-900/40 rounded-2xl p-4 sm:p-6 backdrop-blur-sm border border-gray-800/50 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 flex items-center gap-2">
              <span>{greeting}!</span>
              <span className="text-2xl">🎬</span>
            </h1>
            <p className="text-gray-300 text-sm sm:text-lg break-words">
              {getPersonalizedMessage()}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm text-gray-400">
            {!isAuthenticated ? (
              <Link 
                to="/auth"
                className="bg-red-600 hover:bg-red-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-all duration-300 hover:scale-105 shadow-lg font-medium"
              >
                Sign In
              </Link>
            ) : (
              <>
                <div className="flex items-center space-x-2 bg-white/10 px-3 py-1 rounded-full">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span className="hidden sm:inline">Personalized for you</span>
                  <span className="sm:hidden">Personal</span>
                </div>
                
                <div className="flex items-center space-x-2 bg-white/10 px-3 py-1 rounded-full">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <span className="capitalize">{timeOfDay}</span>
                </div>
              </>
            )}
          </div>
        </div>
        
        {isAuthenticated && profile && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-red-600/30 text-red-400 rounded-full text-xs font-medium border border-red-500/20">
              Authenticated User
            </span>
            <span className="px-3 py-1 bg-blue-600/30 text-blue-400 rounded-full text-xs font-medium border border-blue-500/20">
              Personal Lists Available
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalizedWelcome;
