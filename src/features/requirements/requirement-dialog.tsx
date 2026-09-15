"use client";

import { useState, type FormEvent } from "react";
import * as api from "@/lib/api";
import {
  REQUIREMENT_STATUSES,
  REQUIREMENT_TYPES,
  type Requirement,
  type RequirementStatus,
  type RequirementType,
  type UUID,
} from "@/lib/api";
import { keys } from "@/lib/query";
import { useApiMutation } from "@/lib/hooks";
import { requirementStatusLabel, requirementTypeLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ScopePicker } from "@/components/layout/scope-picker";

export function RequirementDialog({
  open,
  onClose,
  requirement,
  defaults,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  requirement?: Requirement;
  defaults?: Partial<api.RequirementInput>;
  onSaved?: (requirement: Requirement) => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={requirement ? "Edit requirement" : "New requirement"}
    >
      <RequirementDialogForm
        onClose={onClose}
        requirement={requirement}
        defaults={defaults}
        onSaved={onSaved}
      />
    </Dialog>
  );
}

function RequirementDialogForm({
  onClose,
  requirement,
  defaults,
  onSaved,
}: {
  onClose: () => void;
  requirement?: Requirement;
  defaults?: Partial<api.RequirementInput>;
  onSaved?: (requirement: Requirement) => void;
}) {
  const [title, setTitle] = useState(
    requirement?.title ?? defaults?.title ?? "",
  );
  const [description, setDescription] = useState(
    requirement?.description ?? defaults?.description ?? "",
  );
  const [type, setType] = useState<RequirementType>(
    requirement?.type ?? defaults?.type ?? "requirement",
  );
  const [status, setStatus] = useState<RequirementStatus>(
    requirement?.status ?? defaults?.status ?? "unreviewed",
  );
  const [scope, setScope] = useState<{
    organizationId: UUID | null;
    projectId: UUID | null;
  }>({
    organizationId:
      requirement?.organizationId ?? defaults?.organizationId ?? null,
    projectId: requirement?.projectId ?? defaults?.projectId ?? null,
  });

  const save = useApiMutation(
    (input: api.RequirementInput) =>
      requirement
        ? api.requirements.update(requirement.id, input)
        : api.requirements.create(input),
    {
      invalidate: [keys.requirements.all, keys.organizations.all],
      onSuccess: (saved) => {
        onSaved?.(saved);
        onClose();
      },
    },
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    save.mutate({
      title: title.trim(),
      description: description.trim() || null,
      type,
      status,
      ...scope,
      ...(requirement
        ? {}
        : {
            sourceMeetingId: defaults?.sourceMeetingId,
            sourceNoteItemId: defaults?.sourceNoteItemId,
          }),
    });
  };

  return (
    <>
      <DialogBody>
        <form
          id="requirement-form"
          onSubmit={submit}
          className="flex flex-col gap-4"
        >
          <Field label="Title" htmlFor="req-title">
            <Input
              id="req-title"
              autoFocus
              required
              maxLength={500}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Export invoices as PDF"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" htmlFor="req-type">
              <Select
                id="req-type"
                value={type}
                onChange={(e) => setType(e.target.value as RequirementType)}
              >
                {REQUIREMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {requirementTypeLabel[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status" htmlFor="req-status">
              <Select
                id="req-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as RequirementStatus)}
              >
                {REQUIREMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {requirementStatusLabel[s]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Filed under">
            <ScopePicker
              organizationId={scope.organizationId}
              projectId={scope.projectId}
              onChange={setScope}
            />
          </Field>
          <Field label="Description" htmlFor="req-description">
            <Textarea
              id="req-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </form>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form="requirement-form" loading={save.isPending}>
          {requirement ? "Save" : "Create"}
        </Button>
      </DialogFooter>
    </>
  );
}
