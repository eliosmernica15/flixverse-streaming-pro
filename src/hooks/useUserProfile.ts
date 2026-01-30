import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import { useAuth } from './useAuth';
import { UserProfile } from '@/integrations/firebase/types';

export const useUserProfile = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const profileRef = doc(db, 'profiles', user.uid);
    
    const unsubscribe = onSnapshot(profileRef, async (docSnap) => {
      if (docSnap.exists()) {
        setProfile({ id: docSnap.id, ...docSnap.data() } as UserProfile);
        setLoading(false);
      } else {
        // Create profile if it doesn't exist
        const newProfile: UserProfile = {
          id: user.uid,
          display_name: user.displayName || user.email?.split('@')[0] || null,
          avatar_url: user.photoURL || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        try {
          await setDoc(profileRef, newProfile);
          setProfile(newProfile);
        } catch (error) {
          console.error('Error creating profile:', error);
        }
        setLoading(false);
      }
    }, (error) => {
      console.error('Error fetching profile:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;

    try {
      const profileRef = doc(db, 'profiles', user.uid);
      await updateDoc(profileRef, {
        ...updates,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const profileRef = doc(db, 'profiles', user.uid);
      const docSnap = await getDoc(profileRef);
      if (docSnap.exists()) {
        setProfile({ id: docSnap.id, ...docSnap.data() } as UserProfile);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  return {
    profile,
    loading,
    updateProfile,
    refetch: fetchProfile
  };
};