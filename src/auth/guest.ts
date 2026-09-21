import {
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  OAuthProvider,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  type AuthCredential,
  type AuthProvider,
  type User,
} from "firebase/auth";
import * as api from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase";

/**
 * Guest sessions — Planner without an account.
 *
 * A guest is a Firebase *anonymous* user: a real uid and a real ID token, so
 * planner-api treats it like any other principal and nothing in the data
 * layer knows the difference. The session lives in this browser's IndexedDB
 * and nowhere else, which is the whole trade-off: clear site data and the
 * account is unreachable (the server sweeps it eventually).
 *
 * Upgrading takes one of two paths, and the difference matters:
 *
 * 1. **Link** — the credential is new. Firebase attaches it to the anonymous
 *    user *in place*: same uid, same `users` row, same `user_id` on every
 *    row. No data moves and the API is not involved.
 * 2. **Merge** — the credential already belongs to an account. We keep the
 *    guest's ID token, sign in as the existing account, and hand that token
 *    to `POST /users/adopt`, which moves the guest's rows across.
 *
 * The token is parked in `sessionStorage` between the sign-in and the adopt
 * call, so a failed adopt (network, API down) can be retried on the next
 * page load rather than stranding the guest's data.
 */

const PENDING_ADOPT_KEY = "planner.pendingAdopt";

export type Upgrade =
  | { kind: "popup"; provider: AuthProvider }
  | { kind: "email"; email: string; password: string; create: boolean };

export type UpgradeResult = "linked" | "merged";

export function signInAsGuest() {
  return signInAnonymously(firebaseAuth());
}

export async function upgradeGuest(
  guest: User,
  upgrade: Upgrade,
): Promise<UpgradeResult> {
  const auth = firebaseAuth();

  if (upgrade.kind === "email") {
    if (!upgrade.create) {
      // "I already have an account": no link attempt, straight to a merge.
      return mergeGuestInto(guest, () =>
        signInWithEmailAndPassword(auth, upgrade.email, upgrade.password),
      );
    }
    // `auth/email-already-in-use` surfaces here; the page turns it into
    // "sign in instead", which then takes the branch above.
    await linkWithCredential(
      guest,
      EmailAuthProvider.credential(upgrade.email, upgrade.password),
    );
    return "linked";
  }

  try {
    await linkWithPopup(guest, upgrade.provider);
    return "linked";
  } catch (error) {
    const credential = credentialFromCollision(error, upgrade.provider);
    if (!credential) throw error;
    return mergeGuestInto(guest, () => signInWithCredential(auth, credential));
  }
}

/**
 * The credential Firebase hands back when a link fails because the account
 * already exists. Null for any other failure, including a closed popup.
 */
function credentialFromCollision(
  error: unknown,
  provider: AuthProvider,
): AuthCredential | null {
  const code = (error as { code?: string })?.code;
  if (code !== "auth/credential-already-in-use") return null;
  const firebaseError = error as Parameters<
    typeof OAuthProvider.credentialFromError
  >[0];
  return provider instanceof GoogleAuthProvider
    ? GoogleAuthProvider.credentialFromError(firebaseError)
    : OAuthProvider.credentialFromError(firebaseError);
}

async function mergeGuestInto(
  guest: User,
  signIn: () => Promise<unknown>,
): Promise<UpgradeResult> {
  // Forced refresh: the token has to outlive the sign-in *and* the adopt, and
  // a cached one may be minutes from expiry.
  const sourceToken = await guest.getIdToken(true);
  setPending(sourceToken);
  try {
    await signIn();
  } catch (error) {
    // Still the guest — nothing to adopt later.
    setPending(null);
    throw error;
  }
  await adoptPending();
  return "merged";
}

/**
 * Finishes a merge whose adopt call did not complete. Called on every app
 * shell mount; a no-op when nothing is pending. Returns true when data was
 * merged just now, so the caller can drop its query cache.
 */
export async function retryPendingAdopt(): Promise<boolean> {
  if (!readPending()) return false;
  const user = firebaseAuth().currentUser;
  if (!user || user.isAnonymous) return false;
  try {
    await adoptPending();
    return true;
  } catch {
    // Left in place for the next load; the token expires within the hour and
    // the server rejects it then, at which point the entry is dropped below.
    return false;
  }
}

async function adoptPending(): Promise<void> {
  const sourceToken = readPending();
  if (!sourceToken) return;
  try {
    await api.users.adopt({ sourceToken });
  } catch (error) {
    // An expired or already-adopted token will never succeed; keep only the
    // failures that a retry can fix.
    if (error instanceof api.ApiError && error.status < 500) setPending(null);
    throw error;
  }
  setPending(null);
}

function readPending(): string | null {
  try {
    return sessionStorage.getItem(PENDING_ADOPT_KEY);
  } catch {
    return null;
  }
}

function setPending(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(PENDING_ADOPT_KEY, token);
    else sessionStorage.removeItem(PENDING_ADOPT_KEY);
  } catch {
    // Storage blocked: the merge still runs, it just cannot be retried.
  }
}
