"use client";

import { useState, type FormEvent } from "react";
import * as api from "@/lib/api";
import type { Decision, UUID } from "@/lib/api";
import { keys } from "@/lib/query";
import { useApiMutation } from "@/lib/hooks";
import { fromDateInput, toDateInput } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ScopePicker } from "@/components/layout/scope-picker";

export function DecisionDialog({
  open,
  onClose,
  decision,
  defaults,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  decision?: Decision;
  defaults?: Partial<api.DecisionInput>;
  onSaved?: (decision: Decision) => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={decision ? "Edit decision" : "Record a decision"}
    >
      <DecisionDialogForm
        onClose={onClose}
        decision={decision}
        defaults={defaults}
        onSaved={onSaved}
      />
    </Dialog>
  );
}

function DecisionDialogForm({
  onClose,
  decision,
  defaults,
  onSaved,
}: {
  onClose: () => void;
  decision?: Decision;
  defaults?: Partial<api.DecisionInput>;
  onSaved?: (decision: Decision) => void;
}) {
  const [text, setText] = useState(
    decision?.decision ?? defaults?.decision ?? "",
  );
  const [reason, setReason] = useState(
    decision?.reason ?? defaults?.reason ?? "",
  );
  const [date, setDate] = useState(
    toDateInput(decision?.date ?? defaults?.date ?? new Date().toISOString()),
  );
  const [scope, setScope] = useState<{
    organizationId: UUID | null;
    projectId: UUID | null;
  }>({
    organizationId:
      decision?.organizationId ?? defaults?.organizationId ?? null,
    projectId: decision?.projectId ?? defaults?.projectId ?? null,
  });

  const save = useApiMutation(
    (input: api.DecisionInput) =>
      decision
        ? api.decisions.update(decision.id, input)
        : api.decisions.create(input),
    {
      invalidate: [keys.decisions.all],
      onSuccess: (saved) => {
        onSaved?.(saved);
        onClose();
      },
    },
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    save.mutate({
      decision: text.trim(),
      reason: reason.trim() || null,
      date: fromDateInput(date) ?? new Date().toISOString(),
      ...scope,
      ...(decision ? {} : { sourceMeetingId: defaults?.sourceMeetingId }),
    });
  };

  return (
    <>
      <DialogBody>
        <form
          id="decision-form"
          onSubmit={submit}
          className="flex flex-col gap-4"
        >
          <Field label="Decision" htmlFor="decision-text">
            <Textarea
              id="decision-text"
              autoFocus
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="We will ship the web client before billing."
              className="min-h-16"
            />
          </Field>
          <Field
            label="Why"
            htmlFor="decision-reason"
            hint="Future-you will ask."
          >
            <Textarea
              id="decision-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-16"
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr]">
            <Field label="Date" htmlFor="decision-date">
              <Input
                id="decision-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Filed under">
              <ScopePicker
                organizationId={scope.organizationId}
                projectId={scope.projectId}
                onChange={setScope}
                compact
              />
            </Field>
          </div>
        </form>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form="decision-form" loading={save.isPending}>
          {decision ? "Save" : "Record"}
        </Button>
      </DialogFooter>
    </>
  );
}
