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

  const emailForConfirm = me.data?.email ?? user?.email ?? "";

  return (
    <>
      <PageHeader title="Settings" />

      {me.isLoading ? (
        <Spinner />
      ) : (
        <div className="flex max-w-xl flex-col gap-5">
          {me.data && (
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
                {user?.providerData
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
            <div className="mt-4 flex gap-2">
              <Button variant="outline" onClick={() => void signOut()}>
                Sign out
              </Button>
            </div>
          </Card>

          <Card className="border-danger/30 p-5 text-sm">
            <h2 className="text-danger mb-1 font-medium">Delete account</h2>
            <p className="text-fg-muted">
              Erases your sign-in and every organization, project, task,
              meeting, note and attachment you own — on the server and, on next
              sync, on your phone. There is no undo.
            </p>
            <div className="mt-3">
              <Button variant="danger" onClick={() => setConfirmErase(true)}>
                Delete my account…
              </Button>
            </div>
          </Card>
        </div>
      )}

      <Dialog
        open={confirmErase}
        onClose={() => setConfirmErase(false)}
        title="Delete your account?"
        size="sm"
      >
        <DialogBody>
          <p className="text-fg-muted text-sm">
            Type <span className="text-fg font-mono">{emailForConfirm}</span> to
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
            disabled={typed !== emailForConfirm}
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
