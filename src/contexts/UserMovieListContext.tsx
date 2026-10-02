"use client";

import { createContext, useContext } from "react";
import { useUserMovieList as useUserMovieListHook } from "@/hooks/useUserMovieList";

type UserMovieListContextValue = ReturnType<typeof useUserMovieListHook>;

const UserMovieListContext = createContext<UserMovieListContextValue | null>(null);

export function UserMovieListProvider({ children }: { children: React.ReactNode }) {
  const value = useUserMovieListHook();

  return (
    <UserMovieListContext.Provider value={value}>{children}</UserMovieListContext.Provider>
  );
}

export function useUserMovieListContext() {
  const context = useContext(UserMovieListContext);
  if (!context) {
    throw new Error("useUserMovieListContext must be used within UserMovieListProvider");
  }
  return context;
}
