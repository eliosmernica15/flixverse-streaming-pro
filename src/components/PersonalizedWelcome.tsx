
import { useState, useEffect } from 'react';
import { Clock, Star, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import Link from 'next/link';
import { motion } from 'framer-motion';

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
    <motion.div
      className="px-4 sm:px-6 lg:px-8 py-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <div className="max-w-[1800px] mx-auto">
        <div className="glass-card rounded-2xl p-4 sm:p-6 border border-white/5 shadow-2xl relative overflow-hidden">
          {/* Background gradient accent */}
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-purple-500/5 to-blue-500/10 pointer-events-none" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <motion.h1
                className="text-2xl sm:text-3xl font-bold text-white mb-2 flex items-center gap-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <span>{greeting}!</span>
                <Sparkles className="w-6 h-6 text-yellow-500" />
              </motion.h1>
              <motion.p
                className="text-gray-400 text-sm sm:text-base"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                {getPersonalizedMessage()}
              </motion.p>
            </div>

            <motion.div
              className="flex flex-wrap items-center gap-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              {!isAuthenticated ? (
                <Link
                  href="/auth"
                  className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white px-5 py-2.5 rounded-xl transition-all duration-300 hover:scale-105 shadow-lg shadow-red-500/20 font-semibold text-sm"
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
            </motion.div>
          </div>

          {isAuthenticated && profile && (
            <motion.div
              className="relative z-10 mt-4 flex flex-wrap gap-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <span className="px-3 py-1.5 bg-red-500/15 text-red-400 rounded-lg text-xs font-medium border border-red-500/20">
                Premium Member
              </span>
              <span className="px-3 py-1.5 bg-blue-500/15 text-blue-400 rounded-lg text-xs font-medium border border-blue-500/20">
                Personal Lists Available
              </span>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default PersonalizedWelcome;
