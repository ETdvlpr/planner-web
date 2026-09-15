"use client";

import { useState, type FormEvent } from "react";
import * as api from "@/lib/api";
import {
  RECURRENCE_FREQUENCIES,
  TASK_CONTEXTS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  type RecurrenceFrequency,
  type RecurrenceSpec,
  type DeadlinePrecision,
  type Task,
  type TaskContextTag,
  type TaskPriority,
  type TaskStatus,
  type TaskType,
  type UUID,
} from "@/lib/api";
import { keys } from "@/lib/query";
import { useApiMutation } from "@/lib/hooks";
import {
  addDays,
  endOfWeek,
  fromDateInput,
  fromDateTimeInput,
  recurrenceLabel,
  taskContextLabel,
  taskPriorityLabel,
  taskStatusLabel,
  taskTypeLabel,
  toDateInput,
  toDateTimeInput,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogFooter } from "@/components/ui/dialog";
import {
  Checkbox,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/field";
import { ScopePicker } from "@/components/layout/scope-picker";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface TaskDefaults {
  organizationId?: UUID | null;
  projectId?: UUID | null;
  status?: TaskStatus;
  type?: TaskType;
  title?: string;
  sourceMeetingId?: UUID;
  sourceRequirementId?: UUID;
  parentTaskId?: UUID;
}

/**
 * Create or edit a task. Every field the API accepts is here, but the form
 * opens on the few that matter (title, where it goes, when it is due) and
 * the rest sit behind "More".
 *
 * Recurrence can only be set on create: the API stores the rule once and
 * every occurrence points at it, so editing it mid-series is a different,
 * unbuilt operation.
 */
export function TaskDialog({
  open,
  onClose,
  task,
  defaults,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  task?: Task;
  defaults?: TaskDefaults;
  onSaved?: (task: Task) => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={task ? "Edit task" : "New task"}
      size="lg"
    >
      <TaskDialogForm
        onClose={onClose}
        task={task}
        defaults={defaults}
        onSaved={onSaved}
      />
    </Dialog>
  );
}

function TaskDialogForm({
  onClose,
  task,
  defaults,
  onSaved,
}: {
  onClose: () => void;
  task?: Task;
  defaults?: TaskDefaults;
  onSaved?: (task: Task) => void;
}) {
  const [title, setTitle] = useState(task?.title ?? defaults?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(
    task?.status ?? defaults?.status ?? "inbox",
  );
  const [type, setType] = useState<TaskType>(
    task?.type ?? defaults?.type ?? "projectWork",
  );
  const [priority, setPriority] = useState<TaskPriority>(
    task?.priority ?? "p2",
  );
  const [context, setContext] = useState<TaskContextTag | "">(
    task?.context ?? "",
  );
  const [scope, setScope] = useState<{
    organizationId: UUID | null;
    projectId: UUID | null;
  }>({
    organizationId: task?.organizationId ?? defaults?.organizationId ?? null,
    projectId: task?.projectId ?? defaults?.projectId ?? null,
  });
  const [deadline, setDeadline] = useState(toDateInput(task?.deadline));
  const [deadlinePrecision, setDeadlinePrecision] = useState<DeadlinePrecision>(
    task?.deadlinePrecision ?? "day",
  );
  const [reminderAt, setReminderAt] = useState(
    toDateTimeInput(task?.reminderAt),
  );
  const [followUpDate, setFollowUpDate] = useState(
    toDateInput(task?.followUpDate),
  );
  const [waitingOn, setWaitingOn] = useState(task?.waitingOn ?? "");
  const [more, setMore] = useState(
    Boolean(
      task?.reminderAt ||
      task?.followUpDate ||
      task?.context ||
      task?.waitingOn,
    ),
  );
  const [recurring, setRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceSpec>({
    frequency: "weekly",
    interval: 1,
  });

  const save = useApiMutation(
    (input: api.TaskInput) =>
      task ? api.tasks.update(task.id, input) : api.tasks.create(input),
    {
      invalidate: [keys.tasks.all, keys.organizations.all, keys.meetings.all],
      onSuccess: (saved) => {
        onSaved?.(saved);
        onClose();
      },
    },
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    // A task filed under a project or organization is no longer an inbox
    // item; promote it so it shows up where it was filed.
    const effectiveStatus =
      status === "inbox" && (scope.organizationId || scope.projectId)
        ? "next"
        : status;
    save.mutate({
      title: title.trim(),
      description: description.trim() || null,
      status: effectiveStatus,
      type,
      priority,
      context: context || null,
      ...scope,
      deadline: fromDateInput(deadline),
      deadlinePrecision,
      reminderAt: fromDateTimeInput(reminderAt),
      followUpDate: fromDateInput(followUpDate),
      waitingOn: status === "waiting" ? waitingOn.trim() || null : null,
      ...(task
        ? {}
        : {
            sourceMeetingId: defaults?.sourceMeetingId,
            sourceRequirementId: defaults?.sourceRequirementId,
            parentTaskId: defaults?.parentTaskId,
            recurrence: recurring ? recurrence : undefined,
          }),
    });
  };

  const setSpec = (patch: Partial<RecurrenceSpec>) =>
    setRecurrence((r) => ({ ...r, ...patch }));

  // "This week" is the point: most work has a soft deadline, and the honest
  // answer to "when?" is a week, not an invented day. A week deadline is the
  // Sunday that ends it, and stays out of Overdue until then.
  const today = new Date();
  const quickDeadlines: {
    label: string;
    date: Date;
    precision: DeadlinePrecision;
  }[] = [
    { label: "Today", date: today, precision: "day" },
    { label: "Tomorrow", date: addDays(today, 1), precision: "day" },
    { label: "This week", date: endOfWeek(today), precision: "week" },
    {
      label: "Next week",
      date: addDays(endOfWeek(today), 7),
      precision: "week",
    },
  ];
  const pickQuick = (q: (typeof quickDeadlines)[number]) => {
    setDeadline(toDateInput(q.date.toISOString()));
    setDeadlinePrecision(q.precision);
  };
  const clearDeadline = () => {
    setDeadline("");
    setDeadlinePrecision("day");
  };
  const isQuick = (q: (typeof quickDeadlines)[number]) =>
    deadline === toDateInput(q.date.toISOString()) &&
    deadlinePrecision === q.precision;

  return (
    <>
      <DialogBody>
        <form id="task-form" onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Title" htmlFor="task-title">
            <Input
              id="task-title"
              autoFocus
              required
              maxLength={500}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="File Q3 VAT return"
            />
          </Field>

          <Field label="Filed under">
            <ScopePicker
              organizationId={scope.organizationId}
              projectId={scope.projectId}
              onChange={setScope}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Status" htmlFor="task-status">
              <Select
                id="task-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {taskStatusLabel[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Priority" htmlFor="task-priority">
              <Select
                id="task-priority"
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
            <Field label="Type" htmlFor="task-type">
              <Select
                id="task-type"
                value={type}
                onChange={(e) => setType(e.target.value as TaskType)}
              >
                {TASK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {taskTypeLabel[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Deadline"
              htmlFor="task-deadline"
              hint={
                deadline && deadlinePrecision === "week"
                  ? "Soft — any day up to this one"
                  : undefined
              }
            >
              <Input
                id="task-deadline"
                type="date"
                value={deadline}
                onChange={(e) => {
                  // A hand-picked date is a firm day.
                  setDeadline(e.target.value);
                  setDeadlinePrecision("day");
                }}
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-1.5" aria-label="Quick deadlines">
            {quickDeadlines.map((q) => (
              <Button
                key={q.label}
                size="sm"
                variant={isQuick(q) ? "secondary" : "outline"}
                aria-pressed={isQuick(q)}
                onClick={() => (isQuick(q) ? clearDeadline() : pickQuick(q))}
              >
                {q.label}
              </Button>
            ))}
          </div>

          {status === "waiting" && (
            <Field label="Waiting on" htmlFor="task-waiting">
              <Input
                id="task-waiting"
                value={waitingOn}
                onChange={(e) => setWaitingOn(e.target.value)}
                placeholder="Finance, the supplier, a reply from Sara…"
              />
            </Field>
          )}

          <Field label="Description" htmlFor="task-description">
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-16"
            />
          </Field>

          <button
            type="button"
            onClick={() => setMore((m) => !m)}
            className="text-accent self-start text-xs font-medium hover:underline"
          >
            {more ? "Fewer options" : "More options"}
          </button>

          {more && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Context" htmlFor="task-context">
                <Select
                  id="task-context"
                  value={context}
                  onChange={(e) =>
                    setContext(e.target.value as TaskContextTag | "")
                  }
                >
                  <option value="">None</option>
                  {TASK_CONTEXTS.map((c) => (
                    <option key={c} value={c}>
                      {taskContextLabel[c]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Reminder" htmlFor="task-reminder">
                <Input
                  id="task-reminder"
                  type="datetime-local"
                  value={reminderAt}
                  onChange={(e) => setReminderAt(e.target.value)}
                />
              </Field>
              <Field label="Follow up on" htmlFor="task-followup">
                <Input
                  id="task-followup"
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                />
              </Field>
            </div>
          )}

          {!task && (
            <div className="border-border rounded-lg border p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={recurring}
                  onChange={(e) => setRecurring(e.target.checked)}
                />
                Repeats
                {recurring && (
                  <span className="text-fg-muted ml-auto text-xs font-normal">
                    {recurrenceLabel(recurrence)}
                  </span>
                )}
              </label>
              {recurring && (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Frequency">
                    <Select
                      value={recurrence.frequency}
                      onChange={(e) =>
                        setSpec({
                          frequency: e.target.value as RecurrenceFrequency,
                        })
                      }
                    >
                      {RECURRENCE_FREQUENCIES.map((f) => (
                        <option key={f} value={f}>
                          {frequencyLabel[f]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {[
                    "everyNWeeks",
                    "everyNMonths",
                    "daily",
                    "weekly",
                    "monthly",
                    "yearly",
                  ].includes(recurrence.frequency) && (
                    <Field label="Every">
                      <Input
                        type="number"
                        min={1}
                        value={recurrence.interval ?? 1}
                        onChange={(e) =>
                          setSpec({ interval: Number(e.target.value) || 1 })
                        }
                      />
                    </Field>
                  )}
                  {(recurrence.frequency === "monthly" ||
                    recurrence.frequency === "everyNMonths" ||
                    recurrence.frequency === "yearly") && (
                    <Field label="Day of month">
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        value={recurrence.dayOfMonth ?? ""}
                        onChange={(e) =>
                          setSpec({
                            dayOfMonth: Number(e.target.value) || undefined,
                          })
                        }
                      />
                    </Field>
                  )}
                  {recurrence.frequency === "yearly" && (
                    <Field label="Month">
                      <Input
                        type="number"
                        min={1}
                        max={12}
                        value={recurrence.monthOfYear ?? ""}
                        onChange={(e) =>
                          setSpec({
                            monthOfYear: Number(e.target.value) || undefined,
                          })
                        }
                      />
                    </Field>
                  )}
                  {recurrence.frequency === "selectedWeekdays" && (
                    <Field label="On" className="col-span-2 sm:col-span-3">
                      <div className="flex flex-wrap gap-1.5">
                        {WEEKDAYS.map((day, i) => {
                          const on =
                            ((recurrence.weekdaysMask ?? 0) & (1 << i)) !== 0;
                          return (
                            <button
                              type="button"
                              key={day}
                              onClick={() =>
                                setSpec({
                                  weekdaysMask:
                                    (recurrence.weekdaysMask ?? 0) ^ (1 << i),
                                })
                              }
                              className={
                                "h-8 w-11 rounded-md border text-xs font-medium " +
                                (on
                                  ? "border-accent bg-accent-soft text-accent"
                                  : "border-border text-fg-muted hover:bg-surface-2")
                              }
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                  )}
                  <Field label="Ends" hint="Optional">
                    <Input
                      type="date"
                      value={toDateInput(recurrence.endDate)}
                      onChange={(e) =>
                        setSpec({
                          endDate: fromDateInput(e.target.value) ?? undefined,
                        })
                      }
                    />
                  </Field>
                </div>
              )}
            </div>
          )}
        </form>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form="task-form" loading={save.isPending}>
          {task ? "Save" : "Create"}
        </Button>
      </DialogFooter>
    </>
  );
}

const frequencyLabel: Record<RecurrenceFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
  selectedWeekdays: "Selected weekdays",
  everyNWeeks: "Every N weeks",
  everyNMonths: "Every N months",
};
