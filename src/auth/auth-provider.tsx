"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";

interface AuthState {
  /** `undefined` until Firebase has restored (or ruled out) a session. */
  user: User | null | undefined;
  /** Set when the SDK could not start — almost always missing env vars. */
  configError: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Tracks the Firebase session. Nothing here talks to planner-api: the API
 * learns about a user the first time `/users/me` is called with their token,
 * which the app shell does as soon as it mounts.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialising the SDK is the first thing that can fail, and it fails on
  // configuration, not on runtime state — so it is decided once, lazily, and
  // surfaced on the sign-in page instead of as a blank screen.
  const [configError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      firebaseAuth();
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  });
  const [user, setUser] = useState<User | null | undefined>(
    configError ? null : undefined,
  );

  useEffect(() => {
    if (configError) return;
    return onAuthStateChanged(firebaseAuth(), setUser);
  }, [configError]);

  const value = useMemo<AuthState>(
    () => ({ user, configError, signOut: () => signOut(firebaseAuth()) }),
    [user, configError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
