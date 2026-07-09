"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Settings, User, Shield } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { MemberProfile, ProfileType } from "@/integrations/firebase/types";

const AVATAR_COLORS = [
  "from-red-500 to-orange-600",
  "from-blue-500 to-cyan-600",
  "from-green-500 to-emerald-600",
  "from-purple-500 to-pink-600",
  "from-yellow-500 to-amber-600",
  "from-indigo-500 to-blue-600",
];

function getAvatarColor(index: number) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

interface ProfilePickerProps {
  onSelectProfile: (profile: MemberProfile) => void;
}

export function ProfilePicker({ onSelectProfile }: ProfilePickerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [profiles, setProfiles] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<ProfileType>("standard");

  useEffect(() => {
    if (!user) return;
    loadProfiles();
  }, [user]);

  const loadProfiles = async () => {
    if (!user) return;
    try {
      const { getFirestore, collection, query, where, getDocs } = await import("firebase/firestore");
      const db = getFirestore();
      const profilesRef = collection(db, "member_profiles");
      const q = query(profilesRef, where("ownerId", "==", user.uid));
      const snap = await getDocs(q);
      const items: MemberProfile[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as MemberProfile);
      });

      // If no profiles exist, create a primary one
      if (items.length === 0) {
        const primary: MemberProfile = {
          id: "primary",
          ownerId: user.uid,
          displayName: user.displayName || "Profile",
          avatarUrl: user.photoURL,
          type: "standard",
          isPrimary: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setProfiles([primary]);
      } else {
        setProfiles(items.sort((a, b) => (a.isPrimary ? -1 : b.isPrimary ? 1 : 0)));
      }
    } catch (err) {
      console.error("Failed to load profiles:", err);
      // Fallback to a single default profile
      setProfiles([{
        id: "primary",
        ownerId: user?.uid || "",
        displayName: user?.displayName || "Profile",
        avatarUrl: user?.photoURL,
        type: "standard",
        isPrimary: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProfile = useCallback(async () => {
    if (!newName.trim() || !user) return;
    if (profiles.length >= 5) {
      toast({ title: "Max profiles reached", description: "You can create up to 5 profiles.", variant: "destructive" });
      return;
    }

    try {
      const { getFirestore, collection, addDoc } = await import("firebase/firestore");
      const db = getFirestore();
      const newProfile: Omit<MemberProfile, "id"> = {
        ownerId: user.uid,
        displayName: newName.trim(),
        avatarUrl: null,
        type: newType,
        isPrimary: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const docRef = await addDoc(collection(db, "member_profiles"), newProfile);
      setProfiles((prev) => [...prev, { ...newProfile, id: docRef.id }]);
      setShowCreate(false);
      setNewName("");
      setNewType("standard");
      toast({ title: "Profile created", description: `${newProfile.displayName} has been added.` });
    } catch (err) {
      toast({ title: "Error", description: "Failed to create profile.", variant: "destructive" });
    }
  }, [newName, newType, user, profiles.length, toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading profiles…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
      <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">Who&apos;s watching?</h1>
      <p className="text-gray-400 text-sm mb-10">Select a profile to continue</p>

      <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 mb-10">
        {profiles.map((profile, index) => (
          <button
            key={profile.id}
            onClick={() => onSelectProfile(profile)}
            className="group flex flex-col items-center gap-3 focus-ring"
          >
            <div className="relative">
              {profile.avatarUrl ? (
                <div className="overflow-hidden rounded-2xl border-2 border-transparent transition-all group-hover:scale-105 group-hover:border-white hover-lift-sm ring-2 ring-white/10">
                  <Image
                    src={profile.avatarUrl}
                    alt={profile.displayName}
                    fill
                    className="object-cover"
                    sizes="128px"
                  />
                </div>
              ) : (
                <div className={`flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-2 border-transparent bg-gradient-to-br transition-all group-hover:scale-105 group-hover:border-white hover-lift-sm ring-2 ring-white/10 sm:h-32 sm:w-32 ${getAvatarColor(index)}`}>
                  <span className="text-3xl font-black text-white sm:text-4xl">
                    {profile.displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              {profile.type === "kids" && (
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-white">K</span>
                </div>
              )}
            </div>
            <span className="text-sm text-gray-400 group-hover:text-white transition-colors max-w-[100px] truncate">
              {profile.displayName}
            </span>
          </button>
        ))}

        {/* Add profile button */}
        {profiles.length < 5 && (
          <button
            onClick={() => setShowCreate(true)}
            className="group flex flex-col items-center gap-3 focus-ring"
          >
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-dashed border-white/20 bg-white/5 transition-all group-hover:scale-105 group-hover:border-white/40 hover-lift-sm sm:h-32 sm:w-32">
              <Plus className="h-8 w-8 text-gray-500 transition-colors group-hover:text-white" />
            </div>
            <span className="text-sm text-gray-500 transition-colors group-hover:text-white">
              Add Profile
            </span>
          </button>
        )}
      </div>

      {/* Manage profiles link */}
      <button
        onClick={() => router.push("/profile/settings")}
        className="flex items-center gap-2 rounded-xl border border-white/20 px-6 py-2.5 text-sm text-gray-400 transition-colors hover:border-white/40 hover:text-white focus-ring"
      >
        <Settings className="w-4 h-4" />
        Manage Profiles
      </button>

      {/* Create profile dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-sm animate-scale-in overflow-hidden rounded-2xl border-white/10 glass-strong">
            <div className="border-b border-white/10 p-5">
              <h2 className="font-bold text-white">Create Profile</h2>
              <p className="mt-0.5 text-xs text-gray-500">Add a new profile to this account</p>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-gray-400">
                  Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter name"
                  maxLength={24}
                  className="focus-ring w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-white/20"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleCreateProfile();
                  }}
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-gray-400">
                  Profile Type
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewType("standard")}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors focus-ring ${
                      newType === "standard"
                        ? "border-white/20 bg-white/10 text-white"
                        : "border-white/5 bg-white/5 text-gray-500 hover:text-white"
                    }`}
                  >
                    <User className="w-4 h-4" />
                    Standard
                  </button>
                  <button
                    onClick={() => setNewType("kids")}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors focus-ring ${
                      newType === "kids"
                        ? "border-blue-500/30 bg-blue-500/20 text-blue-400"
                        : "border-white/5 bg-white/5 text-gray-500 hover:text-white"
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    Kids
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-2 p-5 pt-0">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-gray-400 transition-colors hover:text-white focus-ring"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProfile}
                disabled={!newName.trim()}
                className="btn-primary flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-30 focus-ring"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
