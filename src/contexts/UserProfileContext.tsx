"use client";

import { createContext, useContext } from "react";
import { useUserProfile as useUserProfileHook } from "@/hooks/useUserProfile";

type UserProfileContextValue = ReturnType<typeof useUserProfileHook>;

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const value = useUserProfileHook();

  return (
    <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>
  );
}

export function useUserProfileContext() {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error("useUserProfileContext must be used within UserProfileProvider");
  }
  return context;
}
