"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { env } from "@/lib/env";
import { keys } from "@/lib/query";
import { useApiMutation, useMe } from "@/lib/hooks";
import { useAuth } from "@/auth/auth-provider";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Dialog, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Card, PageHeader, Spinner } from "@/components/ui/misc";
import { MobileAppCard } from "./mobile-app-card";

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const me = useMe();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmErase, setConfirmErase] = useState(false);
  const [typed, setTyped] = useState("");

  const erase = useApiMutation(() => api.users.deleteAccount(), {
    onSuccess: async () => {
      queryClient.clear();
      await signOut();
      router.replace("/sign-in");
    },
  });

  const guest = user?.isAnonymous ?? false;
  // A guest has no email to type back; the word will do.
  const emailForConfirm = me.data?.email ?? user?.email ?? "";
  const confirmWord = guest || !emailForConfirm ? "delete" : emailForConfirm;

  return (
    <>
      <PageHeader title="Settings" />

      {me.isLoading ? (
        <Spinner />
      ) : (
        <div className="flex max-w-xl flex-col gap-5">
          {guest && (
            <Card className="border-warn/30 p-5 text-sm">
              <h2 className="mb-1 font-medium">Guest session</h2>
              <p className="text-fg-muted">
                Everything you capture is tied to this browser. Clearing site
                data, or switching devices, loses it. Sign in and it all moves
                to your account — including on your phone.
              </p>
              <div className="mt-3">
                <Button onClick={() => router.push("/sign-in")}>
                  Sign in to keep your data
                </Button>
              </div>
            </Card>
          )}

          {me.data && !guest && (
            // Keyed on the server value so a save re-seeds the form.
            <ProfileForm
              key={me.data.updatedAt}
              initialName={me.data.displayName ?? ""}
              email={emailForConfirm}
            />
          )}

          <Card className="p-5 text-sm">
            <h2 className="mb-3 font-medium">Account</h2>
            <dl className="text-fg-muted grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt>Signed in with</dt>
              <dd>
                {guest
                  ? "Guest (this browser only)"
                  : user?.providerData
                      .map((p) => p.providerId.replace(".com", ""))
                      .join(", ") || "email"}
              </dd>
              <dt>Member since</dt>
              <dd>{formatDateTime(me.data?.createdAt)}</dd>
              <dt>Last seen</dt>
              <dd>{formatDateTime(me.data?.lastSeenAt)}</dd>
              <dt>Web build</dt>
              <dd className="font-mono text-xs">{env.version}</dd>
            </dl>
            {/* Signing a guest out is losing the data; the honest control
                for that is the deletion below. */}
            {!guest && (
              <div className="mt-4 flex gap-2">
                <Button variant="outline" onClick={() => void signOut()}>
                  Sign out
                </Button>
              </div>
            )}
          </Card>

          <MobileAppCard />

          <Card className="border-danger/30 p-5 text-sm">
            <h2 className="text-danger mb-1 font-medium">
              {guest ? "Delete guest data" : "Delete account"}
            </h2>
            <p className="text-fg-muted">
              {guest
                ? "Erases this guest session and every organization, project, task, meeting, note and attachment in it. There is no undo."
                : "Erases your sign-in and every organization, project, task, meeting, note and attachment you own — on the server and, on next sync, on your phone. There is no undo."}
            </p>
            <div className="mt-3">
              <Button variant="danger" onClick={() => setConfirmErase(true)}>
                {guest ? "Delete guest data…" : "Delete my account…"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <Dialog
        open={confirmErase}
        onClose={() => setConfirmErase(false)}
        title={guest ? "Delete guest data?" : "Delete your account?"}
        size="sm"
      >
        <DialogBody>
          <p className="text-fg-muted text-sm">
            Type <span className="text-fg font-mono">{confirmWord}</span> to
            confirm.
          </p>
          <Input
            className="mt-3"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setConfirmErase(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={typed !== confirmWord}
            loading={erase.isPending}
            onClick={() => erase.mutate()}
          >
            Delete everything
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}

function ProfileForm({
  initialName,
  email,
}: {
  initialName: string;
  email: string;
}) {
  const [displayName, setDisplayName] = useState(initialName);
  const save = useApiMutation(
    (input: api.UpdateProfileInput) => api.users.update(input),
    {
      invalidate: [keys.me],
      successMessage: "Profile saved",
    },
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({ displayName: displayName.trim() || undefined });
  };
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-medium">Profile</h2>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Display name" htmlFor="display-name">
          <Input
            id="display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={200}
          />
        </Field>
        <Field label="Email" hint="Managed by your sign-in provider.">
          <Input value={email} disabled />
        </Field>
        <div className="flex justify-end">
          <Button
            type="submit"
            loading={save.isPending}
            disabled={displayName.trim() === initialName}
          >
            Save
          </Button>
        </div>
      </form>
    </Card>
  );
}
