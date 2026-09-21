/**
 * Public configuration. Everything here ships to the browser, which is fine:
 * a Firebase web config is not a secret (it identifies the project; the
 * authorised-domains list does the gatekeeping), and the API URL is public
 * by definition.
 *
 * Reading `process.env.NEXT_PUBLIC_*` by literal name is what lets Next.js
 * inline the values at build time — a dynamic lookup would come back empty.
 * Nothing throws at import time so the static build can prerender pages;
 * `assertFirebaseConfig()` runs when the SDK is first needed in the browser.
 */
export const env = {
  apiUrl: (
    process.env.NEXT_PUBLIC_API_URL ?? "https://memory-api.dave.com.et/api/v1"
  ).replace(/\/$/, ""),
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  },
  /** Shown in Settings so a bug report can say which build it came from. */
  version: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
  /**
   * GitHub repo whose releases carry the Android APK (see
   * `planner-mobile/scripts/release-android.sh`). Empty disables every
   * "get the app" surface.
   */
  androidReleasesRepo:
    process.env.NEXT_PUBLIC_ANDROID_RELEASES_REPO ?? "ETdvlpr/planner-mobile",
};

export function assertFirebaseConfig(): void {
  const missing = Object.entries(env.firebase)
    .filter(([, value]) => !value)
    .map(
      ([key]) =>
        `NEXT_PUBLIC_FIREBASE_${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`,
    );
  if (missing.length) {
    throw new Error(
      `Firebase is not configured: missing ${missing.join(", ")}. ` +
        "Copy .env.example to .env.local and fill it in.",
    );
  }
}
