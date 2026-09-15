"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CalendarDays,
  Check,
  Hourglass,
  MoreHorizontal,
  Repeat,
} from "lucide-react";
import * as api from "@/lib/api";
import type { Task } from "@/lib/api";
import { keys } from "@/lib/query";
import { useApiMutation } from "@/lib/hooks";
import {
  formatDate,
  formatDeadline,
  isOverdue,
  taskStatusLabel,
} from "@/lib/format";
import { Badge } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ScopeLabel } from "@/components/layout/scope-picker";
import { TaskDialog } from "./task-dialog";
import { cn } from "@/lib/utils";

const priorityTone = { p1: "danger", p2: "neutral", p3: "outline" } as const;

/**
 * One task in a list. Completing is a single click on the circle; everything
 * else is behind the menu so the row stays scannable.
 */
export function TaskRow({
  task,
  showScope = true,
  showStatus = false,
  className,
}: {
  task: Task;
  showScope?: boolean;
  showStatus?: boolean;
  className?: string;
}) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const invalidate = [
    keys.tasks.all,
    keys.activity.all,
    keys.organizations.all,
  ];
  const complete = useApiMutation(() => api.tasks.complete(task.id), {
    invalidate,
    successMessage: (r) =>
      r.next ? `Done — next one is ${formatDate(r.next.deadline)}` : "Done",
  });
  const reopen = useApiMutation(() => api.tasks.reopen(task.id), {
    invalidate,
  });
  const drop = useApiMutation(() => api.tasks.drop(task.id), { invalidate });
  const carry = useApiMutation(() => api.tasks.carryForward(task.id), {
    invalidate,
    successMessage: "Carried forward",
  });
  const remove = useApiMutation(() => api.tasks.remove(task.id), {
    invalidate,
    onSuccess: () => setConfirmDelete(false),
  });
  const setStatus = useApiMutation(
    (status: Task["status"]) => api.tasks.update(task.id, { status }),
    { invalidate },
  );

  const done = task.status === "done";
  const dropped = task.status === "dropped";
  const closed = done || dropped;
  const overdue = !closed && isOverdue(task.deadline);

  return (
    <div
      className={cn(
        "group hover:bg-surface-2 flex items-start gap-3 rounded-lg px-2 py-2 transition-colors",
        className,
      )}
    >
      <button
        onClick={() => (done ? reopen.mutate() : complete.mutate())}
        disabled={complete.isPending || reopen.isPending}
        className={cn(
          "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors",
          done
            ? "border-ok bg-ok text-white"
            : "border-border-strong hover:border-accent hover:bg-accent-soft",
          dropped && "border-dashed opacity-50",
        )}
        aria-label={done ? "Reopen" : "Complete"}
        title={done ? "Reopen" : "Complete"}
      >
        {done && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>

      <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span
            className={cn(
              "text-sm leading-5",
              closed && "text-fg-faint line-through",
            )}
          >
            {task.title}
          </span>
          {task.priority === "p1" && !closed && (
            <Badge tone={priorityTone.p1}>P1</Badge>
          )}
          {task.priority === "p3" && !closed && (
            <Badge tone="outline">P3</Badge>
          )}
          {showStatus && <Badge>{taskStatusLabel[task.status]}</Badge>}
          {task.status === "waiting" && (
            <Badge tone="warn">
              <Hourglass className="h-3 w-3" />
              {task.waitingOn ? `Waiting on ${task.waitingOn}` : "Waiting"}
            </Badge>
          )}
          {task.recurringSeriesId && (
            <Repeat
              className="text-fg-faint h-3.5 w-3.5"
              aria-label="Recurring"
            />
          )}
          {task.carryForwardCount > 0 && !closed && (
            <Badge tone="violet" className="gap-1">
              ↻ {task.carryForwardCount}
            </Badge>
          )}
        </div>
        <div className="text-fg-faint mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          {showScope && (
            <ScopeLabel
              organizationId={task.organizationId}
              projectId={task.projectId}
            />
          )}
          {task.deadline && !closed && (
            <span
              className={cn(
                "flex items-center gap-1",
                overdue && "text-danger font-medium",
              )}
            >
              {overdue ? (
                <AlertCircle className="h-3 w-3" />
              ) : (
                <CalendarDays className="h-3 w-3" />
              )}
              {formatDeadline(task.deadline, task.deadlinePrecision)}
            </span>
          )}
          {done && task.completedAt && (
            <span>Done {formatDate(task.completedAt)}</span>
          )}
        </div>
      </Link>

      <div className="relative shrink-0">
        <button
          onClick={() => setMenu((m) => !m)}
          onBlur={() => setTimeout(() => setMenu(false), 150)}
          className="text-fg-faint hover:bg-border rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
          aria-label="Task actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menu && (
          <div className="border-border bg-surface shadow-card absolute top-full right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border py-1 text-sm">
            <MenuItem onClick={() => setEditing(true)}>Edit…</MenuItem>
            {task.status !== "next" && !closed && (
              <MenuItem onClick={() => setStatus.mutate("next")}>
                Move to Next
              </MenuItem>
            )}
            {task.status !== "someday" && !closed && (
              <MenuItem onClick={() => setStatus.mutate("someday")}>
                Someday
              </MenuItem>
            )}
            {!closed && (
              <MenuItem onClick={() => carry.mutate()}>Carry forward</MenuItem>
            )}
            {!closed && <MenuItem onClick={() => drop.mutate()}>Drop</MenuItem>}
            {closed && (
              <MenuItem onClick={() => reopen.mutate()}>Reopen</MenuItem>
            )}
            <div className="border-border my-1 border-t" />
            <MenuItem
              onClick={() => setConfirmDelete(true)}
              className="text-danger"
            >
              Delete…
            </MenuItem>
          </div>
        )}
      </div>

      <TaskDialog
        open={editing}
        onClose={() => setEditing(false)}
        task={task}
      />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        destructive
        title="Delete task?"
        description={`"${task.title}" and its checklist will be removed. Activity you logged against it is kept.`}
        confirmLabel="Delete"
      />
    </div>
  );
}

function MenuItem({
  onClick,
  className,
  children,
}: {
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn(
        "hover:bg-surface-2 block w-full px-3 py-1.5 text-left",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TaskList({
  tasks,
  showScope,
  showStatus,
  empty,
}: {
  tasks: Task[];
  showScope?: boolean;
  showStatus?: boolean;
  empty?: React.ReactNode;
}) {
  if (tasks.length === 0) return <>{empty ?? null}</>;
  return (
    <div className="divide-border border-border bg-surface divide-y rounded-xl border">
      {tasks.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          showScope={showScope}
          showStatus={showStatus}
          className="rounded-none first:rounded-t-xl last:rounded-b-xl"
        />
      ))}
    </div>
  );
}
