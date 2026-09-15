"use client";

import { useState, type FormEvent } from "react";
import * as api from "@/lib/api";
import { ORG_STATUSES, type Organization } from "@/lib/api";
import { keys } from "@/lib/query";
import { useApiMutation } from "@/lib/hooks";
import { orgStatusLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogFooter } from "@/components/ui/dialog";
import {
  Checkbox,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/field";

export function OrganizationDialog({
  open,
  onClose,
  organization,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  organization?: Organization;
  onSaved?: (organization: Organization) => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={organization ? "Edit organization" : "New organization"}
    >
      <OrganizationDialogForm
        onClose={onClose}
        organization={organization}
        onSaved={onSaved}
      />
    </Dialog>
  );
}

function OrganizationDialogForm({
  onClose,
  organization,
  onSaved,
}: {
  onClose: () => void;
  organization?: Organization;
  onSaved?: (organization: Organization) => void;
}) {
  const [name, setName] = useState(organization?.name ?? "");
  const [description, setDescription] = useState(
    organization?.description ?? "",
  );
  const [status, setStatus] = useState<Organization["status"]>(
    organization?.status ?? "active",
  );
  const [favorite, setFavorite] = useState(organization?.favorite ?? false);

  const save = useApiMutation(
    (input: api.OrganizationInput) =>
      organization
        ? api.organizations.update(organization.id, input)
        : api.organizations.create(input),
    {
      invalidate: [keys.organizations.all],
      onSuccess: (saved) => {
        onSaved?.(saved);
        onClose();
      },
    },
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    save.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      status,
      favorite,
    });
  };

  return (
    <>
      <DialogBody>
        <form
          id="organization-form"
          onSubmit={submit}
          className="flex flex-col gap-4"
        >
          <Field label="Name" htmlFor="org-name">
            <Input
              id="org-name"
              autoFocus
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Infnova"
            />
          </Field>
          <Field label="Description" htmlFor="org-description">
            <Textarea
              id="org-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this is, who is involved, anything future-you needs."
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status" htmlFor="org-status">
              <Select
                id="org-status"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as Organization["status"])
                }
              >
                {ORG_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {orgStatusLabel[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <Checkbox
                checked={favorite}
                onChange={(e) => setFavorite(e.target.checked)}
              />
              Favourite
            </label>
          </div>
        </form>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form="organization-form" loading={save.isPending}>
          {organization ? "Save" : "Create"}
        </Button>
      </DialogFooter>
    </>
  );
}
