"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";
import { Spinner } from "@/components/ui/misc";

/**
 * Gate for the authenticated part of the app. Renders nothing decisive until
 * Firebase has answered, so a signed-in user does not see a flash of the
 * sign-in page on every reload.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (user === null) {
      const next =
        pathname && pathname !== "/"
          ? `?next=${encodeURIComponent(pathname)}`
          : "";
      router.replace(`/sign-in${next}`);
    }
  }, [user, router, pathname]);

  if (!user) return <Spinner className="h-screen" />;
  return <>{children}</>;
}
