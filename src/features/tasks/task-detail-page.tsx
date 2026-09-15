"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  X,
} from "lucide-react";
import * as api from "@/lib/api";
import type { ChecklistItem, Task } from "@/lib/api";
import { keys } from "@/lib/query";
import { useApiMutation, useLookup } from "@/lib/hooks";
import {
  formatDate,
  formatDateTime,
  formatDeadline,
  isOverdue,
  taskContextLabel,
  taskPriorityLabel,
  taskStatusLabel,
  taskTypeLabel,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Badge, Card, ErrorState, Spinner } from "@/components/ui/misc";
import { AttachmentList } from "@/features/attachments/attachment-list";
import { NotesPanel } from "@/features/notes/notes-panel";
import { TaskDialog } from "./task-dialog";
import { TaskList } from "./task-row";
import { cn } from "@/lib/utils";

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const lookup = useLookup();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);

  const task = useQuery({
    queryKey: keys.tasks.one(id),
    queryFn: () => api.tasks.get(id),
  });
  const subtasks = useQuery({
    queryKey: keys.tasks.list({ parentTaskId: id }),
    queryFn: () => api.tasks.list({ parentTaskId: id, pageSize: 100 }),
    enabled: Boolean(task.data && !task.data.parentTaskId),
  });
  const parent = useQuery({
    queryKey: keys.tasks.one(task.data?.parentTaskId ?? ""),
    queryFn: () => api.tasks.get(task.data!.parentTaskId!),
    enabled: Boolean(task.data?.parentTaskId),
  });
  const series = useQuery({
    queryKey: keys.tasks.series(task.data?.recurringSeriesId ?? ""),
    queryFn: () => api.tasks.series(task.data!.recurringSeriesId!),
    enabled: Boolean(task.data?.recurringSeriesId),
  });
  const meeting = useQuery({
    queryKey: keys.meetings.one(task.data?.sourceMeetingId ?? ""),
    queryFn: () => api.meetings.get(task.data!.sourceMeetingId!),
    enabled: Boolean(task.data?.sourceMeetingId),
  });

  const invalidate = [
    keys.tasks.all,
    keys.activity.all,
    keys.organizations.all,
  ];
  const complete = useApiMutation(() => api.tasks.complete(id), {
    invalidate,
    successMessage: (r) =>
      r.next ? `Done — next one is ${formatDate(r.next.deadline)}` : "Done",
  });
  const reopen = useApiMutation(() => api.tasks.reopen(id), { invalidate });
  const drop = useApiMutation(() => api.tasks.drop(id), { invalidate });
  const carry = useApiMutation(() => api.tasks.carryForward(id), {
    invalidate,
    successMessage: "Carried forward",
  });
  const remove = useApiMutation(() => api.tasks.remove(id), {
    invalidate,
    successMessage: "Task deleted",
    onSuccess: () => router.push("/tasks"),
  });

  if (task.isLoading) return <Spinner />;
  if (task.error || !task.data) {
    return <ErrorState error={task.error ?? new Error("Task not found")} />;
  }
  const t = task.data;
  const closed = t.status === "done" || t.status === "dropped";
  const org = lookup.organization(t.organizationId);
  const project = lookup.project(t.projectId);

  return (
    <>
      <div className="text-fg-muted mb-4 flex items-center gap-2 text-sm">
        <button
          onClick={() => router.back()}
          className="hover:text-fg flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        {parent.data && (
          <>
            <span>/</span>
            <Link
              href={`/tasks/${parent.data.id}`}
              className="hover:text-fg truncate"
            >
              {parent.data.title}
            </Link>
          </>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
        <div className="flex flex-col gap-5">
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <button
                onClick={() =>
                  t.status === "done" ? reopen.mutate() : complete.mutate()
                }
                className={cn(
                  "mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  t.status === "done"
                    ? "border-ok bg-ok text-white"
                    : "border-border-strong hover:border-accent",
                )}
                aria-label={t.status === "done" ? "Reopen" : "Complete"}
              >
                {t.status === "done" && (
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <h1
                  className={cn(
                    "text-xl font-semibold tracking-tight",
                    closed && "text-fg-faint line-through",
                  )}
                >
                  {t.title}
                </h1>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge
                    tone={
                      t.status === "done"
                        ? "ok"
                        : t.status === "waiting"
                          ? "warn"
                          : "accent"
                    }
                  >
                    {taskStatusLabel[t.status]}
                  </Badge>
                  <Badge tone={t.priority === "p1" ? "danger" : "neutral"}>
                    {taskPriorityLabel[t.priority]}
                  </Badge>
                  <Badge>{taskTypeLabel[t.type]}</Badge>
                  {t.context && (
                    <Badge tone="outline">{taskContextLabel[t.context]}</Badge>
                  )}
                  {t.deadline && (
                    <Badge
                      tone={
                        !closed && isOverdue(t.deadline) ? "danger" : "outline"
                      }
                    >
                      <CalendarDays className="h-3 w-3" />
                      Due {formatDeadline(t.deadline, t.deadlinePrecision)}
                    </Badge>
                  )}
                  {t.recurringSeriesId && (
                    <Badge tone="violet">
                      <Repeat className="h-3 w-3" />
                      Recurring
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditing(true)}
                aria-label="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>

            {t.description && (
              <p className="text-fg mt-4 text-sm leading-relaxed whitespace-pre-wrap">
                {t.description}
              </p>
            )}
            {t.status === "waiting" && t.waitingOn && (
              <p className="text-warn mt-3 text-sm">Waiting on {t.waitingOn}</p>
            )}
          </Card>

          <Card className="p-5">
            <Checklist taskId={t.id} />
          </Card>

          {!t.parentTaskId && (
            <Card className="p-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium">
                  Subtasks{" "}
                  {subtasks.data && subtasks.data.total > 0 && (
                    <span className="text-fg-faint">{subtasks.data.total}</span>
                  )}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAddingSubtask(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
              <TaskList
                tasks={subtasks.data?.items ?? []}
                showScope={false}
                empty={
                  <p className="text-fg-faint text-xs">
                    No subtasks. One level only.
                  </p>
                }
              />
            </Card>
          )}

          <Card className="p-5">
            <NotesPanel
              query={{ taskId: t.id }}
              defaults={{ taskId: t.id, ...scopeOf(t) }}
            />
          </Card>

          <Card className="p-5">
            <AttachmentList
              scope={{ taskId: t.id, ...scopeOf(t) }}
              query={{ taskId: t.id }}
            />
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="p-4 text-sm">
            <h3 className="text-fg-muted mb-2 text-[12px] font-medium tracking-wide uppercase">
              Filed under
            </h3>
            {org || project ? (
              <div className="flex flex-col gap-1">
                {org && (
                  <Link
                    href={`/organizations/${org.id}`}
                    className="hover:underline"
                  >
                    {org.name}
                  </Link>
                )}
                {project && (
                  <Link
                    href={`/projects/${project.id}`}
                    className="text-fg-muted hover:underline"
                  >
                    {project.name}
                  </Link>
                )}
              </div>
            ) : (
              <p className="text-fg-faint">Inbox — not filed yet</p>
            )}
            {meeting.data && (
              <p className="text-fg-muted mt-3 text-xs">
                From meeting{" "}
                <Link
                  href={`/meetings/${meeting.data.id}`}
                  className="text-accent hover:underline"
                >
                  {meeting.data.title}
                </Link>
              </p>
            )}
          </Card>

          <Card className="text-fg-muted p-4 text-xs">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              {t.reminderAt && (
                <>
                  <dt>Reminder</dt>
                  <dd>{formatDateTime(t.reminderAt)}</dd>
                </>
              )}
              {t.followUpDate && (
                <>
                  <dt>Follow up</dt>
                  <dd>{formatDate(t.followUpDate)}</dd>
                </>
              )}
              {t.completedAt && (
                <>
                  <dt>Completed</dt>
                  <dd>{formatDateTime(t.completedAt)}</dd>
                </>
              )}
              {t.carryForwardCount > 0 && (
                <>
                  <dt>Carried</dt>
                  <dd>
                    {t.carryForwardCount}× (last{" "}
                    {formatDate(t.carriedForwardAt)})
                  </dd>
                </>
              )}
              <dt>Created</dt>
              <dd>{formatDateTime(t.createdAt)}</dd>
              <dt>Updated</dt>
              <dd>{formatDateTime(t.updatedAt)}</dd>
            </dl>
          </Card>

          <Card className="flex flex-col gap-1 p-2">
            {!closed && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => carry.mutate()}
                >
                  Carry forward
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => drop.mutate()}
                >
                  Drop
                </Button>
              </>
            )}
            {closed && (
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => reopen.mutate()}
              >
                Reopen
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-danger justify-start"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </Card>

          {series.data && series.data.length > 1 && (
            <Card className="p-4 text-sm">
              <h3 className="text-fg-muted mb-2 text-[12px] font-medium tracking-wide uppercase">
                Series history
              </h3>
              <ul className="flex flex-col gap-1">
                {series.data.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/tasks/${s.id}`}
                      className={cn(
                        "hover:bg-surface-2 flex items-center justify-between gap-2 rounded px-1 py-0.5 text-xs",
                        s.id === t.id && "bg-accent-soft text-accent",
                      )}
                    >
                      <span>{formatDate(s.deadline ?? s.createdAt)}</span>
                      <Badge tone={s.status === "done" ? "ok" : "neutral"}>
                        {taskStatusLabel[s.status]}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>

      <TaskDialog open={editing} onClose={() => setEditing(false)} task={t} />
      <TaskDialog
        open={addingSubtask}
        onClose={() => setAddingSubtask(false)}
        defaults={{ parentTaskId: t.id, ...scopeOf(t), status: "next" }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        destructive
        title="Delete task?"
        description="The checklist goes with it. Activity you logged against it is kept."
        confirmLabel="Delete"
      />
    </>
  );
}

function scopeOf(t: Task) {
  return { organizationId: t.organizationId, projectId: t.projectId };
}

function Checklist({ taskId }: { taskId: string }) {
  const [label, setLabel] = useState("");
  const items = useQuery({
    queryKey: keys.tasks.checklist(taskId),
    queryFn: () => api.tasks.checklist(taskId),
  });
  const invalidate = [keys.tasks.checklist(taskId)];
  const add = useApiMutation(
    (input: api.ChecklistItemInput) =>
      api.tasks.addChecklistItem(taskId, input),
    { invalidate, onSuccess: () => setLabel("") },
  );
  const toggle = useApiMutation(
    (item: ChecklistItem) =>
      api.tasks.updateChecklistItem(item.id, { done: !item.done }),
    { invalidate },
  );
  const remove = useApiMutation(
    (itemId: string) => api.tasks.removeChecklistItem(itemId),
    {
      invalidate,
    },
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    add.mutate({ label: label.trim(), position: items.data?.length ?? 0 });
  };

  const done = items.data?.filter((i) => i.done).length ?? 0;
  const total = items.data?.length ?? 0;

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium">
          Checklist{" "}
          {total > 0 && (
            <span className="text-fg-faint">
              {done}/{total}
            </span>
          )}
        </h3>
      </div>
      {total > 0 && (
        <div className="bg-surface-2 mb-3 h-1 overflow-hidden rounded-full">
          <div
            className="bg-ok h-full transition-all"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
      )}
      <ul className="flex flex-col">
        {items.data?.map((item) => (
          <li
            key={item.id}
            className="group hover:bg-surface-2 flex items-center gap-2 rounded-md px-1 py-1"
          >
            <Checkbox
              checked={item.done}
              onChange={() => toggle.mutate(item)}
            />
            <span
              className={cn(
                "flex-1 text-sm",
                item.done && "text-fg-faint line-through",
              )}
            >
              {item.label}
            </span>
            <button
              onClick={() => remove.mutate(item.id)}
              className="text-fg-faint hover:text-danger p-1 opacity-0 group-hover:opacity-100"
              aria-label="Remove item"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="mt-2 flex gap-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Add a step…"
          className="h-8"
        />
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          loading={add.isPending}
          disabled={!label.trim()}
        >
          Add
        </Button>
      </form>
    </>
  );
}
