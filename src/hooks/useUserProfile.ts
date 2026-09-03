import { useState, useEffect, useRef } from 'react';
import { doc, getDocFromServer, setDoc, updateDoc, onSnapshot, type DocumentSnapshot } from 'firebase/firestore';
import { getFirebaseDb, requireFirebaseDb } from '@/integrations/firebase/client';
import { useAuth } from './useAuth';
import { UserProfile } from '@/integrations/firebase/types';
import {
  backfillProfileUsername,
  hasUsername,
  lookupUsernameByUid,
} from '@/lib/username/resolveUsername';
import { isPythonBackendEnabled } from '@/lib/pythonApi/config';
import { usePythonUserProfile } from '@/hooks/useUserProfilePython';

function useFirestoreUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const creatingProfileRef = useRef(false);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      creatingProfileRef.current = false;
      return;
    }

    setLoading(true);
    creatingProfileRef.current = false;

    const db = getFirebaseDb();
    if (!db) {
      setLoading(false);
      return;
    }

    const profileRef = doc(db, 'profiles', user.uid);

    const unsubscribe = onSnapshot(
      profileRef,
      async (docSnap: DocumentSnapshot) => {
        const fromCache = docSnap.metadata.fromCache;
        const exists = docSnap.exists();

        // Avoid treating a cache miss as "no profile" — wait for server confirmation.
        if (!exists && fromCache) {
          return;
        }

        if (exists) {
          const data = docSnap.data();
          let username = (data.username as string | undefined) ?? null;

          if (!hasUsername({ username })) {
            const hydrated = await lookupUsernameByUid(db, user.uid);
            if (hydrated) {
              username = hydrated;
              void backfillProfileUsername(db, user.uid, hydrated);
            }
          }

          setProfile({ id: docSnap.id, ...data, username } as UserProfile);
          setLoading(false);
          return;
        }

        if (creatingProfileRef.current) return;
        creatingProfileRef.current = true;

        const displayName = user.displayName || user.email?.split('@')[0] || 'User';
        const newProfile: UserProfile = {
          id: user.uid,
          display_name: displayName,
          avatar_url: user.photoURL || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        try {
          await setDoc(
            profileRef,
            { ...newProfile, user_id: user.uid },
            { merge: true }
          );
          setProfile(newProfile);
        } catch (error) {
          console.error('Error creating profile:', error);
          creatingProfileRef.current = false;
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching profile:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;

    try {
      const db = requireFirebaseDb();
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
      const db = requireFirebaseDb();
      const profileRef = doc(db, 'profiles', user.uid);
      const docSnap = await getDocFromServer(profileRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        let username = (data.username as string | undefined) ?? null;

        if (!hasUsername({ username })) {
          const hydrated = await lookupUsernameByUid(db, user.uid);
          if (hydrated) {
            username = hydrated;
            void backfillProfileUsername(db, user.uid, hydrated);
          }
        }

        setProfile({ id: docSnap.id, ...data, username } as UserProfile);
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
}

export const useUserProfile = () => {
  return isPythonBackendEnabled() ? usePythonUserProfile() : useFirestoreUserProfile();
};
