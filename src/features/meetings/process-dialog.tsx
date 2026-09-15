"use client";

import { useState, type FormEvent } from "react";
import * as api from "@/lib/api";
import {
  PROCESSED_ITEM_KINDS,
  TASK_PRIORITIES,
  type Meeting,
  type MeetingNoteItem,
  type ProcessedItemKind,
  type TaskPriority,
  type UUID,
} from "@/lib/api";
import { keys } from "@/lib/query";
import { useApiMutation } from "@/lib/hooks";
import {
  fromDateInput,
  processedKindLabel,
  taskPriorityLabel,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ScopePicker } from "@/components/layout/scope-picker";
import { cn } from "@/lib/utils";

/** Which entity each kind creates — mirrors MeetingProcessingService on mobile. */
export function createsTask(kind: ProcessedItemKind) {
  return kind === "task" || kind === "followUp";
}
export function createsRequirement(kind: ProcessedItemKind) {
  return [
    "requirement",
    "feature",
    "idea",
    "investigation",
    "question",
  ].includes(kind);
}
export function requirementTypeFor(
  kind: ProcessedItemKind,
): api.RequirementInput["type"] {
  switch (kind) {
    case "feature":
    case "idea":
    case "investigation":
    case "question":
      return kind;
    default:
      return "requirement";
  }
}

export interface ProcessResult {
  kind: ProcessedItemKind;
  id: UUID;
  title: string;
}

/**
 * Turns one raw line into a task, requirement, decision or note — without
 * touching the raw notes — and records what it became on the note item.
 * The same rules as the mobile app's MeetingProcessingService, so a line
 * processed on either client looks the same on both.
 */
export async function processLine(
  meeting: Meeting,
  input: {
    kind: ProcessedItemKind;
    title: string;
    description?: string;
    organizationId: UUID | null;
    projectId: UUID | null;
    priority?: TaskPriority;
    deadline?: string | null;
    noteItemId?: UUID;
  },
): Promise<ProcessResult> {
  const title = input.title.trim();
  const description = input.description?.trim() || undefined;
  const scope = {
    organizationId: input.organizationId,
    projectId: input.projectId,
  };
  let result: ProcessResult;

  if (createsTask(input.kind)) {
    const task = await api.tasks.create({
      title,
      description,
      ...scope,
      sourceMeetingId: meeting.id,
      type: input.kind === "followUp" ? "followUp" : "projectWork",
      status: "next",
      priority: input.priority ?? "p2",
      deadline: input.deadline ?? undefined,
    });
    result = { kind: input.kind, id: task.id, title: task.title };
  } else if (createsRequirement(input.kind)) {
    const requirement = await api.requirements.create({
      title,
      description,
      ...scope,
      sourceMeetingId: meeting.id,
      sourceNoteItemId: input.noteItemId,
      type: requirementTypeFor(input.kind),
    });
    result = { kind: input.kind, id: requirement.id, title: requirement.title };
  } else if (input.kind === "decision") {
    const decision = await api.decisions.create({
      decision: title,
      reason: description ?? null,
      ...scope,
      sourceMeetingId: meeting.id,
      date: meeting.date,
    });
    result = { kind: input.kind, id: decision.id, title: decision.decision };
  } else {
    const note = await api.notes.create({
      title: title.length > 60 ? null : title,
      body: description ?? title,
      ...scope,
      meetingId: meeting.id,
    });
    result = { kind: input.kind, id: note.id, title };
  }

  if (input.noteItemId) {
    await api.meetings.markProcessed(input.noteItemId, input.kind, result.id);
  }
  return result;
}

export function ProcessDialog({
  open,
  onClose,
  meeting,
  item,
  onProcessed,
}: {
  open: boolean;
  onClose: () => void;
  meeting: Meeting;
  /** The line being processed; absent when creating from the meeting itself. */
  item?: MeetingNoteItem;
  onProcessed?: (result: ProcessResult) => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={item ? "Process this line" : "Create from meeting"}
      description={
        item ? <span className="italic">“{item.content}”</span> : undefined
      }
      size="lg"
    >
      <ProcessDialogForm
        onClose={onClose}
        meeting={meeting}
        item={item}
        onProcessed={onProcessed}
      />
    </Dialog>
  );
}

function ProcessDialogForm({
  onClose,
  meeting,
  item,
  onProcessed,
}: {
  onClose: () => void;
  meeting: Meeting;
  /** The line being processed; absent when creating from the meeting itself. */
  item?: MeetingNoteItem;
  onProcessed?: (result: ProcessResult) => void;
}) {
  const [kind, setKind] = useState<ProcessedItemKind>(
    guessKind(item?.content ?? ""),
  );
  const [title, setTitle] = useState(item?.content ?? "");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("p2");
  const [deadline, setDeadline] = useState("");
  const [scope, setScope] = useState<{
    organizationId: UUID | null;
    projectId: UUID | null;
  }>({ organizationId: meeting.organizationId, projectId: meeting.projectId });

  const run = useApiMutation(
    () =>
      processLine(meeting, {
        kind,
        title,
        description,
        ...scope,
        priority,
        deadline: fromDateInput(deadline),
        noteItemId: item?.id,
      }),
    {
      invalidate: [
        keys.meetings.all,
        keys.tasks.all,
        keys.requirements.all,
        keys.decisions.all,
        keys.notes.all,
      ],
      successMessage: (r) => `${processedKindLabel[r.kind]} created`,
      onSuccess: (r) => {
        onProcessed?.(r);
        onClose();
      },
    },
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    run.mutate();
  };

  const isTask = createsTask(kind);
  const isDecision = kind === "decision";

  return (
    <>
      <DialogBody>
        <form
          id="process-form"
          onSubmit={submit}
          className="flex flex-col gap-4"
        >
          <Field label="Turn it into">
            <div className="flex flex-wrap gap-1.5">
              {PROCESSED_ITEM_KINDS.map((k) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => setKind(k)}
                  className={cn(
                    "h-8 rounded-md border px-2.5 text-xs font-medium transition-colors",
                    kind === k
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border text-fg-muted hover:bg-surface-2",
                  )}
                >
                  {processedKindLabel[k]}
                </button>
              ))}
            </div>
          </Field>

          <Field
            label={isDecision ? "Decision" : "Title"}
            htmlFor="process-title"
          >
            <Input
              id="process-title"
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>

          <Field label="Filed under">
            <ScopePicker
              organizationId={scope.organizationId}
              projectId={scope.projectId}
              onChange={setScope}
            />
          </Field>

          {isTask && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Priority">
                <Select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                >
                  {TASK_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {taskPriorityLabel[p]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Deadline">
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </Field>
            </div>
          )}

          <Field
            label={
              isDecision ? "Why" : kind === "note" ? "Body" : "Description"
            }
            htmlFor="process-description"
          >
            <Textarea
              id="process-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-16"
            />
          </Field>
        </form>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form="process-form" loading={run.isPending}>
          Create {processedKindLabel[kind].toLowerCase()}
        </Button>
      </DialogFooter>
    </>
  );
}

/** A cheap guess from the line's wording; the user confirms with one click. */
function guessKind(line: string): ProcessedItemKind {
  const l = line.toLowerCase();
  if (/\?\s*$/.test(l) || /^(q:|question)/.test(l)) return "question";
  if (/^(decided|decision|agreed|we will|we'll)/.test(l)) return "decision";
  if (/^(idea|maybe|what if|could)/.test(l)) return "idea";
  if (/^(follow ?up|chase|check with|ask)/.test(l)) return "followUp";
  if (/^(feature|add|support|should)/.test(l)) return "feature";
  if (/^(investigate|look into|find out|research)/.test(l))
    return "investigation";
  if (/^(note|fyi|context|background)/.test(l)) return "note";
  return "task";
}
