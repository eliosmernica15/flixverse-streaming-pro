"use client";

import { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/integrations/firebase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Sparkles, Mail, Lock, User, ArrowLeft, Film, Tv, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const signUp = async () => {
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update display name
      const name = displayName || email.split('@')[0];
      await updateProfile(user, { displayName: name });

      // Create user profile in Firestore
      await setDoc(doc(db, 'profiles', user.uid), {
        id: user.uid,
        display_name: name,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      toast({
        title: "Welcome to FlixVerse!",
        description: "Your account has been created successfully",
      });
      router.push('/');
    } catch (error: any) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const signIn = async () => {
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({
        title: "Welcome back!",
        description: "You have been signed in successfully",
      });
      router.push('/');
    } catch (error: any) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Create user profile in Firestore if it doesn't exist
      const name = user.displayName || user.email?.split('@')[0] || 'User';
      await setDoc(doc(db, 'profiles', user.uid), {
        id: user.uid,
        display_name: name,
        avatar_url: user.photoURL,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { merge: true });

      toast({
        title: "Welcome to FlixVerse!",
        description: "You have been signed in successfully with Google",
      });
      router.push('/');
    } catch (error: any) {
      toast({
        title: "Google sign in failed",
        description: error.message,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const floatingIcons = [
    { icon: Film, delay: 0, x: '10%', y: '20%' },
    { icon: Tv, delay: 0.5, x: '80%', y: '15%' },
    { icon: Star, delay: 1, x: '15%', y: '70%' },
    { icon: Film, delay: 1.5, x: '85%', y: '75%' },
    { icon: Star, delay: 2, x: '50%', y: '85%' },
  ];

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/30 via-black to-purple-950/30" />

        {/* Animated gradient orbs */}
        <motion.div
          className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-red-500/10 rounded-full blur-[150px]"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.15, 0.1],
            x: [0, 50, 0]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[150px]"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.1, 0.2, 0.1],
            y: [0, -50, 0]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />

        {/* Floating icons */}
        {floatingIcons.map((item, index) => (
          <motion.div
            key={index}
            className="absolute text-white/5"
            style={{ left: item.x, top: item.y }}
            animate={{
              y: [0, -20, 0],
              rotate: [0, 10, -10, 0]
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              delay: item.delay,
              ease: "easeInOut"
            }}
          >
            <item.icon className="w-12 h-12" />
          </motion.div>
        ))}

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:100px_100px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Back to home link */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Link
            href="/"
            className="inline-flex items-center space-x-2 text-gray-400 hover:text-white mb-8 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm">Back to FlixVerse</span>
          </Link>
        </motion.div>

        {/* Logo and welcome text */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-center mb-6">
            <motion.div
              className="relative"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Sparkles className="w-12 h-12 text-red-500" />
              <div className="absolute inset-0 blur-xl bg-red-500/40 animate-pulse-glow" />
            </motion.div>
            <h1 className="text-4xl font-black ml-3">
              <span className="text-gradient-primary">Flix</span>
              <span className="text-white">Verse</span>
            </h1>
          </div>
          <p className="text-gray-400 text-lg">Your gateway to unlimited entertainment</p>
        </motion.div>

        {/* Auth Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="glass-premium border-white/10 rounded-3xl overflow-hidden">
            <CardHeader className="pb-2 pt-8">
              <CardTitle className="text-white text-center text-2xl font-bold">
                {activeTab === 'signin' ? 'Welcome Back' : 'Join FlixVerse'}
              </CardTitle>
              <CardDescription className="text-gray-400 text-center">
                {activeTab === 'signin'
                  ? 'Sign in to continue your journey'
                  : 'Create an account to get started'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 glass-card rounded-2xl p-1.5 mb-8">
                  <TabsTrigger
                    value="signin"
                    className="text-gray-400 data-[state=active]:text-white data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-600 data-[state=active]:to-red-500 rounded-xl transition-all duration-300 py-3 font-semibold"
                  >
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger
                    value="signup"
                    className="text-gray-400 data-[state=active]:text-white data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-600 data-[state=active]:to-red-500 rounded-xl transition-all duration-300 py-3 font-semibold"
                  >
                    Sign Up
                  </TabsTrigger>
                </TabsList>

                <AnimatePresence mode="wait">
                  <TabsContent value="signin" className="space-y-5 mt-0">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-5"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-gray-300 text-sm font-medium flex items-center space-x-2">
                          <Mail className="w-4 h-4" />
                          <span>Email</span>
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="glass-card border-white/10 text-white placeholder-gray-500 h-14 rounded-xl focus:border-red-500 focus:ring-red-500/20 transition-all duration-300"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-gray-300 text-sm font-medium flex items-center space-x-2">
                          <Lock className="w-4 h-4" />
                          <span>Password</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="glass-card border-white/10 text-white placeholder-gray-500 h-14 rounded-xl pr-14 focus:border-red-500 focus:ring-red-500/20 transition-all duration-300"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1"
                          >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                      <Button
                        onClick={signIn}
                        disabled={loading}
                        className="w-full h-14 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold text-lg rounded-xl shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transition-all duration-300 hover:scale-[1.02] btn-shine mt-2"
                      >
                        {loading ? (
                          <motion.div
                            className="flex items-center space-x-2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                          >
                            <motion.div
                              className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            />
                            <span>Signing in...</span>
                          </motion.div>
                        ) : "Sign In"}
                      </Button>

                      {/* Divider */}
                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-white/10"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-transparent px-2 text-gray-500">Or continue with</span>
                        </div>
                      </div>

                      {/* Google Sign In Button */}
                      <Button
                        onClick={signInWithGoogle}
                        disabled={loading}
                        variant="outline"
                        className="w-full h-14 glass-card border-white/10 text-white font-semibold text-base rounded-xl hover:bg-white/10 transition-all duration-300 flex items-center justify-center space-x-3"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                        <span>Continue with Google</span>
                      </Button>
                    </motion.div>
                  </TabsContent>

                  <TabsContent value="signup" className="space-y-5 mt-0">
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-5"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="displayName" className="text-gray-300 text-sm font-medium flex items-center space-x-2">
                          <User className="w-4 h-4" />
                          <span>Display Name</span>
                        </Label>
                        <Input
                          id="displayName"
                          type="text"
                          placeholder="How should we call you?"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="glass-card border-white/10 text-white placeholder-gray-500 h-14 rounded-xl focus:border-red-500 focus:ring-red-500/20 transition-all duration-300"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email-signup" className="text-gray-300 text-sm font-medium flex items-center space-x-2">
                          <Mail className="w-4 h-4" />
                          <span>Email</span>
                        </Label>
                        <Input
                          id="email-signup"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="glass-card border-white/10 text-white placeholder-gray-500 h-14 rounded-xl focus:border-red-500 focus:ring-red-500/20 transition-all duration-300"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password-signup" className="text-gray-300 text-sm font-medium flex items-center space-x-2">
                          <Lock className="w-4 h-4" />
                          <span>Password</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="password-signup"
                            type={showPassword ? "text" : "password"}
                            placeholder="Create a secure password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="glass-card border-white/10 text-white placeholder-gray-500 h-14 rounded-xl pr-14 focus:border-red-500 focus:ring-red-500/20 transition-all duration-300"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1"
                          >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                      <Button
                        onClick={signUp}
                        disabled={loading}
                        className="w-full h-14 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold text-lg rounded-xl shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transition-all duration-300 hover:scale-[1.02] btn-shine mt-2"
                      >
                        {loading ? (
                          <motion.div
                            className="flex items-center space-x-2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                          >
                            <motion.div
                              className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            />
                            <span>Creating account...</span>
                          </motion.div>
                        ) : "Create Account"}
                      </Button>

                      {/* Divider */}
                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-white/10"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-transparent px-2 text-gray-500">Or continue with</span>
                        </div>
                      </div>

                      {/* Google Sign Up Button */}
                      <Button
                        onClick={signInWithGoogle}
                        disabled={loading}
                        variant="outline"
                        className="w-full h-14 glass-card border-white/10 text-white font-semibold text-base rounded-xl hover:bg-white/10 transition-all duration-300 flex items-center justify-center space-x-3"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                        <span>Continue with Google</span>
                      </Button>
                    </motion.div>
                  </TabsContent>
                </AnimatePresence>
              </Tabs>

              {/* Terms */}
              <p className="text-xs text-gray-500 text-center mt-6">
                By continuing, you agree to FlixVerse's{' '}
                <a href="#" className="text-red-400 hover:text-red-300">Terms of Service</a>
                {' '}and{' '}
                <a href="#" className="text-red-400 hover:text-red-300">Privacy Policy</a>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
