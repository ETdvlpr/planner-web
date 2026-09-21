"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  type AuthProvider,
} from "firebase/auth";
import { toast } from "sonner";
import { appleProvider, firebaseAuth, googleProvider } from "@/lib/firebase";
import { keys } from "@/lib/query";
import { useAuth } from "./auth-provider";
import { signInAsGuest, upgradeGuest, type UpgradeResult } from "./guest";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

type Mode = "signIn" | "signUp" | "reset";

/** Firebase's error codes, in words a person can act on. */
function describe(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Wrong email or password.";
    case "auth/email-already-in-use":
      return "There is already an account with that email. Sign in instead.";
    case "auth/credential-already-in-use":
    case "auth/account-exists-with-different-credential":
      return "That sign-in already belongs to an account. Sign in with it to merge your guest data.";
    case "auth/weak-password":
      return "Use a password of at least 6 characters.";
    case "auth/invalid-email":
      return "That does not look like an email address.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/unauthorized-domain":
      return "This domain is not authorised in Firebase — add it under Authentication → Settings.";
    default:
      return error instanceof Error ? error.message : "Sign-in failed.";
  }
}

export function SignInPage() {
  const { user, configError } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const next = params.get("next") ?? "/";

  // A guest lands here to keep their data, not to be sent away: the page
  // becomes the upgrade form and only redirects once the account is real.
  const guest = user?.isAnonymous ? user : null;

  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const disabled = busy !== null || configError !== null;

  useEffect(() => {
    // `busy` is a dependency on purpose: a merge swaps the Firebase user
    // mid-way, and leaving before the adopt call finishes would show the
    // existing account's data without the guest's.
    if (user && !user.isAnonymous && !busy) router.replace(next);
  }, [user, busy, router, next]);

  const run = async (label: string, action: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await action();
    } catch (error) {
      toast.error(describe(error));
    } finally {
      setBusy(null);
    }
  };

  const settled = (result: UpgradeResult) => {
    if (result === "merged") {
      // Every cached query belonged to the guest; the account is a different
      // principal with the guest's rows now inside it.
      queryClient.clear();
      toast.success("Your guest data is now in your account.");
    } else {
      void queryClient.invalidateQueries({ queryKey: keys.me });
      toast.success("Account saved. Your data is kept.");
    }
  };

  const withProvider = (label: string, provider: AuthProvider) =>
    run(label, async () => {
      if (guest)
        settled(await upgradeGuest(guest, { kind: "popup", provider }));
      else await signInWithPopup(firebaseAuth(), provider);
    });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (mode === "reset") {
      void run("email", async () => {
        await sendPasswordResetEmail(firebaseAuth(), email);
        toast.success("Password reset email sent.");
        setMode("signIn");
      });
      return;
    }
    void run("email", async () => {
      if (guest) {
        settled(
          await upgradeGuest(guest, {
            kind: "email",
            email,
            password,
            create: mode === "signUp",
          }),
        );
        return;
      }
      await (mode === "signUp"
        ? createUserWithEmailAndPassword(firebaseAuth(), email, password)
        : signInWithEmailAndPassword(firebaseAuth(), email, password));
    });
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="bg-accent text-accent-fg mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold">
            P
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            {guest ? "Keep your data" : "Planner"}
          </h1>
          <p className="text-fg-muted mt-1 text-sm">
            {guest
              ? "Sign in or create an account and everything you captured as a guest comes with you."
              : "Capture in the meeting. Organize at the desk."}
          </p>
        </div>

        <div className="border-border bg-surface shadow-card rounded-xl border p-5">
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="lg"
              loading={busy === "google"}
              disabled={disabled}
              onClick={() => void withProvider("google", googleProvider)}
            >
              <GoogleMark />
              Continue with Google
            </Button>
            <Button
              variant="outline"
              size="lg"
              loading={busy === "apple"}
              disabled={disabled}
              onClick={() => void withProvider("apple", appleProvider)}
            >
              <AppleMark />
              Continue with Apple
            </Button>
          </div>

          <div className="text-fg-faint my-5 flex items-center gap-3 text-xs">
            <span className="bg-border h-px flex-1" />
            or with email
            <span className="bg-border h-px flex-1" />
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            {mode !== "reset" && (
              <Field label="Password" htmlFor="password">
                <Input
                  id="password"
                  type="password"
                  autoComplete={
                    mode === "signUp" ? "new-password" : "current-password"
                  }
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
            )}
            <Button
              type="submit"
              size="lg"
              loading={busy === "email"}
              disabled={disabled}
              className="mt-1"
            >
              {mode === "signUp"
                ? "Create account"
                : mode === "reset"
                  ? "Send reset email"
                  : "Sign in"}
            </Button>
          </form>

          <div className="text-fg-muted mt-4 flex justify-between text-xs">
            {mode === "signIn" ? (
              <>
                <button
                  className="hover:text-fg"
                  onClick={() => setMode("signUp")}
                >
                  Create an account
                </button>
                <button
                  className="hover:text-fg"
                  onClick={() => setMode("reset")}
                >
                  Forgot password?
                </button>
              </>
            ) : (
              <button
                className="hover:text-fg"
                onClick={() => setMode("signIn")}
              >
                ← Back to sign in
              </button>
            )}
          </div>
        </div>

        {!guest && (
          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              loading={busy === "guest"}
              disabled={disabled}
              onClick={() => void run("guest", signInAsGuest)}
            >
              Continue without an account
            </Button>
            <p className="text-fg-faint mt-1 text-xs">
              Your data stays in this browser until you sign in.
            </p>
          </div>
        )}

        {guest ? (
          <p className="text-fg-faint mt-6 text-center text-xs">
            <button className="hover:text-fg" onClick={() => router.push("/")}>
              ← Not now
            </button>
          </p>
        ) : (
          <p className="text-fg-faint mt-6 text-center text-xs">
            Same account as the mobile app. Sign in on either and your data is
            there.
          </p>
        )}
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6C12.3 13.4 17.7 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"
      />
      <path
        fill="#FBBC05"
        d="M10.4 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.8-6z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.7-4-13.6-9.7l-7.8 6C6.5 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M16.4 12.7c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.8 1.3 10.3.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.4-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.8-1.1-2.8-4.2zM13.9 5c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.5-.7.8-1.2 2-1.1 3.1 1.2.1 2.4-.6 3.1-1.4z" />
    </svg>
  );
}
