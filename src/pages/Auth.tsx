import { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/integrations/firebase/client';
import { useNavigate, Link } from 'react-router-dom';
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
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate('/');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

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
      navigate('/');
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
      navigate('/');
    } catch (error: any) {
      toast({
        title: "Sign in failed",
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
            to="/" 
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
