import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  setPersistence,
  type Auth,
} from "firebase/auth";
import { assertFirebaseConfig, env } from "./env";

/**
 * Firebase owns identity; planner-api owns authorization. This module is the
 * only place the Firebase SDK is configured, and the `Auth` it hands out is
 * the only thing the rest of the app needs — the ID token it produces is the
 * sole credential the API accepts.
 *
 * Initialisation is lazy and memoised: lazy so the static build never touches
 * the SDK, memoised because Fast Refresh re-evaluates modules.
 */
let cached: Auth | null = null;

export function firebaseAuth(): Auth {
  if (cached) return cached;
  assertFirebaseConfig();
  const app = getApps().length ? getApp() : initializeApp(env.firebase);
  cached = getAuth(app);
  // Survive a browser restart. The API never sets a cookie, so this is the
  // only thing keeping the user signed in across sessions.
  void setPersistence(cached, browserLocalPersistence);
  return cached;
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Sign in with Apple is mandatory for App Store review once Google sign-in is
// offered, so the mobile app has it; the web offers the same three methods so
// an account created on either side works on the other.
export const appleProvider = new OAuthProvider("apple.com");
appleProvider.addScope("email");
appleProvider.addScope("name");
