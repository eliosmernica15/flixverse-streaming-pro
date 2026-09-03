/**
 * User profile backed by the Python Postgres API.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { pythonFetch } from "@/lib/pythonApi/client";
import { isPythonBackendEnabled, useHttpTransport } from "@/lib/pythonApi/config";
import { UserProfile } from "@/integrations/firebase/types";

const POLL_MS = 60000;

export function usePythonUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const creatingProfileRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const data = await pythonFetch<{ profile: UserProfile | null }>("/profile/me");
      if (data.profile) {
        setProfile(data.profile);
      } else if (!creatingProfileRef.current) {
        creatingProfileRef.current = true;
        const displayName = user.displayName || user.email?.split("@")[0] || "User";
        try {
          await pythonFetch("/profile", {
            method: "POST",
            body: JSON.stringify({
              displayName,
              avatarUrl: user.photoURL || null,
            }),
          });
          const created = await pythonFetch<{ profile: UserProfile | null }>("/profile/me");
          setProfile(created.profile);
        } catch (err) {
          console.error("[user-profile/python] create failed:", err);
        } finally {
          creatingProfileRef.current = false;
        }
      }
    } catch (err) {
      console.error("[user-profile/python] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user || !isPythonBackendEnabled()) {
      setProfile(null);
      setLoading(false);
      return;
    }
    void refresh();
    if (useHttpTransport()) {
      const poll = setInterval(() => void refresh(), POLL_MS);
      return () => clearInterval(poll);
    }
  }, [user, refresh]);

  const updateProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      await pythonFetch("/profile", {
        method: "POST",
        body: JSON.stringify({
          displayName: updates.display_name,
          avatarUrl: updates.avatar_url,
          bio: updates.bio,
          favoriteGenres: updates.favorite_genres || [],
        }),
      });
      void refresh();
    },
    [refresh]
  );

  return { profile, loading, updateProfile, refetch: refresh };
}
