"use client";

import { Download, X } from "lucide-react";
import {
  useAndroidRelease,
  useDismissedAndroidBanner,
  useIsAndroid,
} from "@/lib/android-app";

/**
 * Offers the phone app to people reading the web app on an Android browser —
 * the one place the offer is both relevant and installable. Dismissing it
 * remembers the version, so the banner returns only when a newer build
 * exists. Never shown on desktop or iOS: there is nothing to install there.
 */
export function AndroidAppBanner() {
  const release = useAndroidRelease();
  const android = useIsAndroid();
  const [dismissedTag, dismiss] = useDismissedAndroidBanner();

  if (!android || !release || dismissedTag === release.tag) return null;

  return (
    <div className="bg-accent-soft text-accent flex items-center gap-3 px-4 py-2 text-[13px]">
      <span className="min-w-0 flex-1">
        Planner works offline as an Android app.{" "}
        <a
          href={release.url}
          className="inline-flex items-center gap-1 font-medium underline"
        >
          <Download className="h-3.5 w-3.5" />
          Get v{release.version}
        </a>
      </span>
      <button
        onClick={() => dismiss(release.tag)}
        className="hover:bg-accent/10 rounded-md p-1"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
