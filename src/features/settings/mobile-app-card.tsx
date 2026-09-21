"use client";

import { Download, Smartphone } from "lucide-react";
import { useAndroidRelease } from "@/lib/android-app";
import { formatBytes, formatDate } from "@/lib/format";
import { Card } from "@/components/ui/misc";

/**
 * Where the phone app is found from any device — the Android banner only
 * appears on Android, but someone at a desk still needs a link to send to
 * their phone.
 */
export function MobileAppCard() {
  const release = useAndroidRelease();

  return (
    <Card className="p-5 text-sm">
      <h2 className="mb-1 flex items-center gap-2 font-medium">
        <Smartphone className="text-fg-faint h-4 w-4" />
        Phone app
      </h2>
      <p className="text-fg-muted">
        The Android app captures offline and syncs to this account. It is
        installed directly, not from a store: open the file on the phone and
        allow the install when asked. Updates go over the top and keep your
        data.
      </p>
      {release ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <a
            href={release.url}
            className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-medium shadow-sm"
          >
            <Download className="h-4 w-4" />
            Download for Android
          </a>
          <span className="text-fg-faint text-xs">
            v{release.version}
            {release.sizeBytes ? ` · ${formatBytes(release.sizeBytes)}` : ""}
            {" · "}
            {formatDate(release.publishedAt)}
            {" · "}
            <a href={release.releasesUrl} className="underline">
              all releases
            </a>
          </span>
        </div>
      ) : (
        <p className="text-fg-faint mt-3 text-xs">
          No Android build is published yet.
        </p>
      )}
      <p className="text-fg-faint mt-3 text-xs">
        iPhone: not yet — an iOS build needs App Store distribution.
      </p>
    </Card>
  );
}
