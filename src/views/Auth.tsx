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
import { getFirebaseAuth, requireFirebaseDb } from '@/integrations/firebase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { trackSignup } from "@/lib/analytics";
import { Eye, EyeOff, Sparkles, Mail, Lock, User, ArrowLeft } from 'lucide-react';

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
    const auth = getFirebaseAuth();
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const signUp = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    if (password.length < 8) {
      toast({
        title: "Weak password",
        description: "Use at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error("Firebase is not configured");

      const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      const user = userCredential.user;

      const name = displayName.trim() || trimmedEmail.split('@')[0];
      try {
        await updateProfile(user, { displayName: name });

        const db = requireFirebaseDb();
        await setDoc(doc(db, 'profiles', user.uid), {
          id: user.uid,
          user_id: user.uid,
          display_name: name,
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      } catch (profileErr) {
        await user.delete().catch(() => undefined);
        throw profileErr;
      }

      toast({
        title: "Welcome to FlixVerse!",
        description: "Your account has been created successfully",
      });
      trackSignup("email");
      router.push('/');
    } catch (error: unknown) {
      toast({
        title: "Sign up failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const signIn = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error("Firebase is not configured");

      await signInWithEmailAndPassword(auth, trimmedEmail, password);
      toast({
        title: "Welcome back!",
        description: "You have been signed in successfully",
      });
      router.push('/');
    } catch (error: unknown) {
      toast({
        title: "Sign in failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error("Firebase is not configured");

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const name = user.displayName || user.email?.split('@')[0] || 'User';
      try {
        const db = requireFirebaseDb();
        await setDoc(doc(db, 'profiles', user.uid), {
          id: user.uid,
          user_id: user.uid,
          display_name: name,
          avatar_url: user.photoURL,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { merge: true });
      } catch (profileErr) {
        await user.delete().catch(() => undefined);
        throw profileErr;
      }

      toast({
        title: "Welcome to FlixVerse!",
        description: "You have been signed in successfully with Google",
      });
      trackSignup("google");
      router.push('/');
    } catch (error: unknown) {
      toast({
        title: "Google sign in failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen relative flex items-stretch overflow-hidden bg-[#0a0a0c]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0509] via-[#0a0a0c] to-[#0a0612]" />
        <div className="auth-orb auth-orb-red" />
        <div className="auth-orb auth-orb-purple" />
        <div className="absolute inset-0 opacity-[0.025] bg-[linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] bg-[size:64px_64px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80" />
      </div>

      {/* Left brand panel — visible on lg+ */}
      <div className="relative hidden lg:flex lg:w-1/2 xl:w-3/5 flex-col justify-between p-12 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 30% 30%, rgba(239, 68, 68, 0.25) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 80%, rgba(168, 85, 247, 0.18) 0%, transparent 60%)",
          }}
        />
        <Link href="/" className="group flex items-center gap-2.5 focus-ring rounded-md w-fit">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-red-600 to-red-500 shadow-lg shadow-red-500/30 transition-transform group-hover:scale-105">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-black tracking-tight">
            <span className="text-white">Flix</span>
            <span className="text-red-500">Verse</span>
          </span>
        </Link>
        <div className="max-w-md">
          <h2 className="text-3xl xl:text-4xl font-black tracking-tight text-white leading-[1.1] mb-4">
            Unlimited movies, TV shows, and more.
          </h2>
          <p className="text-base text-gray-300 mb-8">
            Watch anywhere. Cancel anytime. Personalized recommendations across every device.
          </p>
          <ul className="space-y-3 text-sm text-gray-300">
            {[
              "Cinema-grade streaming in 4K HDR",
              "Sync watch parties with friends in real time",
              "Smart lists, ratings, and reviews",
              "Works on every device you own",
            ].map((line) => (
              <li key={line} className="flex items-center gap-2.5">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
                  <svg viewBox="0 0 16 16" className="h-2.5 w-2.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8.5l3 3 7-7" />
                  </svg>
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-gray-500">© {new Date().getFullYear()} FlixVerse. All rights reserved.</p>
      </div>

      {/* Right form panel */}
      <div className="relative flex flex-1 items-center justify-center p-4 sm:p-8 lg:p-12">
        <div className="w-full max-w-[440px] relative z-10 animate-fade-in-up">
          <Link
            href="/"
            className="inline-flex items-center space-x-1.5 text-gray-400 hover:text-white mb-8 transition-colors focus-ring rounded group lg:hidden"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm">Back to FlixVerse</span>
          </Link>

          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-3 lg:hidden">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-red-600 to-red-500 shadow-xl shadow-red-500/40">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              <span className="text-white">Flix</span>
              <span className="text-red-500">Verse</span>
            </h1>
            <p className="text-gray-400 text-sm mt-2">Your gateway to unlimited entertainment</p>
          </div>

          <Card className="glass-strong rounded-2xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden">
            <CardHeader className="pb-2 pt-7 px-7">
              <CardTitle className="text-white text-center text-xl font-bold">
                {activeTab === 'signin' ? 'Sign In' : 'Create Account'}
              </CardTitle>
              <CardDescription className="text-gray-400 text-center text-sm">
                {activeTab === 'signin'
                  ? 'Welcome back. Please sign in to continue.'
                  : 'Join us — it only takes a moment.'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="p-7 pt-3">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 glass-soft rounded-lg p-1 mb-6">
                  <TabsTrigger
                    value="signin"
                    className="text-gray-400 data-[state=active]:text-white data-[state=active]:bg-red-600 rounded-md transition-all duration-200 py-2.5 text-sm font-semibold"
                  >
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger
                    value="signup"
                    className="text-gray-400 data-[state=active]:text-white data-[state=active]:bg-red-600 rounded-md transition-all duration-200 py-2.5 text-sm font-semibold"
                  >
                    Sign Up
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="signin" className="space-y-4 mt-0">
                    <form
                      className="space-y-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void signIn();
                      }}
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor="email" className="text-gray-300 text-xs font-semibold flex items-center space-x-1.5">
                          <Mail className="w-3.5 h-3.5" />
                          <span>Email</span>
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="bg-black/40 border-white/10 text-white placeholder-gray-500 h-12 rounded-md focus:border-red-500/60 focus:ring-red-500/20 transition-all duration-200 focus-ring"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="password" className="text-gray-300 text-xs font-semibold flex items-center space-x-1.5">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Password</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-black/40 border-white/10 text-white placeholder-gray-500 h-12 rounded-md pr-12 focus:border-red-500/60 focus:ring-red-500/20 transition-all duration-200 focus-ring"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1 focus-ring rounded"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <Button
                        type="submit"
                        disabled={loading}
                        variant="gradient"
                        loading={loading}
                        className="w-full h-12 text-white font-bold text-base rounded-md bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transition-all duration-200 btn-shine mt-2"
                      >
                        Sign In
                      </Button>

                      <div className="relative my-5">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-white/10"></div>
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                          <span className="bg-[#0a0a0c] px-3 text-gray-500">Or continue with</span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        onClick={signInWithGoogle}
                        disabled={loading}
                        variant="outline-glow"
                        loading={loading}
                        className="w-full h-12 bg-white/5 border border-white/15 text-white font-semibold text-sm rounded-md hover:bg-white/10 transition-all duration-200 flex items-center justify-center space-x-2.5 press-effect"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                    </form>
                  </TabsContent>

                  <TabsContent value="signup" className="space-y-4 mt-0">
                    <form
                      className="space-y-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void signUp();
                      }}
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor="displayName" className="text-gray-300 text-xs font-semibold flex items-center space-x-1.5">
                          <User className="w-3.5 h-3.5" />
                          <span>Display Name</span>
                        </Label>
                        <Input
                          id="displayName"
                          type="text"
                          placeholder="How should we call you?"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="bg-black/40 border-white/10 text-white placeholder-gray-500 h-12 rounded-md focus:border-red-500/60 focus:ring-red-500/20 transition-all duration-200 focus-ring"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="email-signup" className="text-gray-300 text-xs font-semibold flex items-center space-x-1.5">
                          <Mail className="w-3.5 h-3.5" />
                          <span>Email</span>
                        </Label>
                        <Input
                          id="email-signup"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="bg-black/40 border-white/10 text-white placeholder-gray-500 h-12 rounded-md focus:border-red-500/60 focus:ring-red-500/20 transition-all duration-200 focus-ring"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="password-signup" className="text-gray-300 text-xs font-semibold flex items-center space-x-1.5">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Password</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="password-signup"
                            type={showPassword ? "text" : "password"}
                            placeholder="Create a secure password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-black/40 border-white/10 text-white placeholder-gray-500 h-12 rounded-md pr-12 focus:border-red-500/60 focus:ring-red-500/20 transition-all duration-200 focus-ring"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1 focus-ring rounded"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <Button
                        type="submit"
                        disabled={loading}
                        variant="gradient"
                        loading={loading}
                        className="w-full h-12 text-white font-bold text-base rounded-md bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transition-all duration-200 btn-shine mt-2"
                      >
                        Create Account
                      </Button>

                      <div className="relative my-5">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-white/10"></div>
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                          <span className="bg-[#0a0a0c] px-3 text-gray-500">Or continue with</span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        onClick={signInWithGoogle}
                        disabled={loading}
                        variant="outline-glow"
                        loading={loading}
                        className="w-full h-12 bg-white/5 border border-white/15 text-white font-semibold text-sm rounded-md hover:bg-white/10 transition-all duration-200 flex items-center justify-center space-x-2.5 press-effect"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                    </form>
                  </TabsContent>
              </Tabs>

              <p className="text-[11px] text-gray-500 text-center mt-5">
                By continuing, you agree to FlixVerse&apos;s{' '}
                <Link href="/terms" className="text-red-400 hover:text-red-300 focus-ring rounded">Terms of Service</Link>
                {' '}and{' '}
                <Link href="/privacy" className="text-red-400 hover:text-red-300 focus-ring rounded">Privacy Policy</Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Auth;
