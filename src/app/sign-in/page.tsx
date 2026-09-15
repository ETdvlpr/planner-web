import { Suspense } from "react";
import { SignInPage } from "@/auth/sign-in-page";

export const metadata = { title: "Sign in" };

export default function Page() {
  // useSearchParams needs a Suspense boundary for static rendering.
  return (
    <Suspense>
      <SignInPage />
    </Suspense>
  );
}
