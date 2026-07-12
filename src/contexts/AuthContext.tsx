"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { User, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { getFirebaseAuth } from "@/integrations/firebase/client";
import { clearAuthClientStorage } from "@/lib/auth/sessionCleanup";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    const auth = getFirebaseAuth();
    clearAuthClientStorage();
    if (auth) {
      try {
        await firebaseSignOut(auth);
      } catch (err) {
        console.error("Sign out error:", err);
        throw err;
      }
    }
    if (typeof window !== "undefined") {
      window.location.href = "/auth";
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      signOut,
      isAuthenticated: !!user,
    }),
    [user, loading, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
