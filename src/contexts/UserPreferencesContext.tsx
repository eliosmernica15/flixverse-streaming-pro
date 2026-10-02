"use client";

import { createContext, useContext } from "react";
import { useUserPreferences as useUserPreferencesHook } from "@/hooks/useUserPreferences";

type UserPreferencesContextValue = ReturnType<typeof useUserPreferencesHook>;

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(null);

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const value = useUserPreferencesHook();

  return (
    <UserPreferencesContext.Provider value={value}>{children}</UserPreferencesContext.Provider>
  );
}

export function useUserPreferencesContext() {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error("useUserPreferencesContext must be used within UserPreferencesProvider");
  }
  return context;
}
