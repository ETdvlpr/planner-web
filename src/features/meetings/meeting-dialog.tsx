"use client";

import { useState, type FormEvent } from "react";
import * as api from "@/lib/api";
import type { Meeting, UUID } from "@/lib/api";
import { keys } from "@/lib/query";
import { useApiMutation } from "@/lib/hooks";
import { fromDateTimeInput, toDateTimeInput } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { ScopePicker } from "@/components/layout/scope-picker";

export function MeetingDialog({
  open,
  onClose,
  meeting,
  defaultScope,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  meeting?: Meeting;
  defaultScope?: { organizationId: UUID | null; projectId: UUID | null };
  onSaved?: (meeting: Meeting) => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={meeting ? "Edit meeting" : "New meeting"}
    >
      <MeetingDialogForm
        onClose={onClose}
        meeting={meeting}
        defaultScope={defaultScope}
        onSaved={onSaved}
      />
    </Dialog>
  );
}

function MeetingDialogForm({
  onClose,
  meeting,
  defaultScope,
  onSaved,
}: {
  onClose: () => void;
  meeting?: Meeting;
  defaultScope?: { organizationId: UUID | null; projectId: UUID | null };
  onSaved?: (meeting: Meeting) => void;
}) {
  const [title, setTitle] = useState(meeting?.title ?? "");
  const [date, setDate] = useState(
    toDateTimeInput(meeting?.date ?? new Date().toISOString()),
  );
  const [attendees, setAttendees] = useState(meeting?.attendees ?? "");
  const [scope, setScope] = useState<{
    organizationId: UUID | null;
    projectId: UUID | null;
  }>({
    organizationId:
      meeting?.organizationId ?? defaultScope?.organizationId ?? null,
    projectId: meeting?.projectId ?? defaultScope?.projectId ?? null,
  });

  const save = useApiMutation(
    (input: api.MeetingInput) =>
      meeting
        ? api.meetings.update(meeting.id, input)
        : api.meetings.create(input),
    {
      invalidate: [keys.meetings.all, keys.organizations.all],
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
      date: fromDateTimeInput(date) ?? new Date().toISOString(),
      attendees: attendees.trim() || null,
      ...scope,
    });
  };

  return (
    <>
      <DialogBody>
        <form
          id="meeting-form"
          onSubmit={submit}
          className="flex flex-col gap-4"
        >
          <Field label="Title" htmlFor="meeting-title">
            <Input
              id="meeting-title"
              autoFocus
              required
              maxLength={300}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Weekly sync — Infnova"
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="When" htmlFor="meeting-date">
              <Input
                id="meeting-date"
                type="datetime-local"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field
              label="Attendees"
              htmlFor="meeting-attendees"
              hint="Free text"
            >
              <Input
                id="meeting-attendees"
                value={attendees}
                onChange={(e) => setAttendees(e.target.value)}
                placeholder="Sara, Tom, finance"
              />
            </Field>
          </div>
          <Field label="Filed under">
            <ScopePicker
              organizationId={scope.organizationId}
              projectId={scope.projectId}
              onChange={setScope}
            />
          </Field>
        </form>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form="meeting-form" loading={save.isPending}>
          {meeting ? "Save" : "Start capturing"}
        </Button>
      </DialogFooter>
    </>
  );
}
