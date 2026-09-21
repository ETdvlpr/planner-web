"use client";

import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { env } from "@/lib/env";

/**
 * The phone app is distributed as an APK attached to a GitHub release —
 * `planner-mobile/scripts/release-android.sh` builds and publishes it. The
 * web never embeds the file or its version: it asks GitHub for the latest
 * release and links to the asset, so shipping a new APK needs no web deploy.
 */

export const ANDROID_ASSET = "planner-android.apk";

export interface AndroidRelease {
  /** `v1.2.3` */
  tag: string;
  /** `1.2.3` */
  version: string;
  /** Stable URL — always the newest release's APK. */
  url: string;
  sizeBytes: number | null;
  publishedAt: string;
  /** The release page, for notes and older builds. */
  releasesUrl: string;
}

interface GitHubRelease {
  tag_name: string;
  published_at: string;
  html_url: string;
  assets: { name: string; size: number }[];
}

async function fetchLatest(repo: string): Promise<AndroidRelease | null> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/releases/latest`,
    { headers: { Accept: "application/vnd.github+json" } },
  );
  // 404: no release yet. 403: unauthenticated rate limit. Both mean "nothing
  // to offer right now", not an error worth surfacing.
  if (!res.ok) return null;
  const release = (await res.json()) as GitHubRelease;
  const apk = release.assets.find((a) => a.name === ANDROID_ASSET);
  if (!apk) return null;
  return {
    tag: release.tag_name,
    version: release.tag_name.replace(/^v/, ""),
    url: `https://github.com/${repo}/releases/latest/download/${ANDROID_ASSET}`,
    sizeBytes: apk.size,
    publishedAt: release.published_at,
    releasesUrl: `https://github.com/${repo}/releases`,
  };
}

/** Null while loading, when there is no release, or when the feature is off. */
export function useAndroidRelease(): AndroidRelease | null {
  const repo = env.androidReleasesRepo;
  const query = useQuery({
    queryKey: ["android-release", repo],
    queryFn: () => fetchLatest(repo),
    enabled: repo.length > 0,
    // A release is a rare event; one lookup per session is plenty, and it
    // keeps well inside GitHub's anonymous rate limit.
    staleTime: 60 * 60_000,
    gcTime: 60 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return query.data ?? null;
}

/** True on Android browsers, where the APK can actually be installed. */
function isAndroidDevice(): boolean {
  return (
    typeof navigator !== "undefined" && /android/i.test(navigator.userAgent)
  );
}

const noSubscription = () => () => {};

/**
 * Browser-only, so the server (and the hydrating first render) sees false
 * and the client corrects it without a state update in an effect.
 */
export function useIsAndroid(): boolean {
  return useSyncExternalStore(noSubscription, isAndroidDevice, () => false);
}

const DISMISSED_KEY = "planner:android-banner-dismissed";
const dismissListeners = new Set<() => void>();

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    // Private mode or blocked storage: the banner simply shows every visit.
    return null;
  }
}

/** The release tag the banner was dismissed for, and a way to dismiss it. */
export function useDismissedAndroidBanner(): [
  string | null,
  (tag: string) => void,
] {
  const dismissed = useSyncExternalStore(
    (listener) => {
      dismissListeners.add(listener);
      return () => dismissListeners.delete(listener);
    },
    readDismissed,
    () => null,
  );
  const dismiss = (tag: string) => {
    try {
      localStorage.setItem(DISMISSED_KEY, tag);
    } catch {
      // Nothing to remember it in; it will come back next visit.
    }
    for (const listener of dismissListeners) listener();
  };
  return [dismissed, dismiss];
}
