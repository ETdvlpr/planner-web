"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus, Star, Trash2 } from "lucide-react";
import * as api from "@/lib/api";
import { keys } from "@/lib/query";
import { useApiMutation, useLookup } from "@/lib/hooks";
import {
  formatDateTime,
  projectStatusLabel,
  requirementStatusLabel,
  requirementTypeLabel,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Badge, Card, ErrorState, Spinner, Tabs } from "@/components/ui/misc";
import { TaskList } from "@/features/tasks/task-row";
import { TaskDialog } from "@/features/tasks/task-dialog";
import { MeetingDialog } from "@/features/meetings/meeting-dialog";
import { NotesPanel } from "@/features/notes/notes-panel";
import { AttachmentList } from "@/features/attachments/attachment-list";
import { RequirementDialog } from "@/features/requirements/requirement-dialog";
import { ProjectDialog } from "./project-dialog";

type TaskView = "open" | "someday" | "done";

export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const lookup = useLookup();
  const [editing, setEditing] = useState(false);
  const [newTask, setNewTask] = useState(false);
  const [newMeeting, setNewMeeting] = useState(false);
  const [newRequirement, setNewRequirement] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [taskView, setTaskView] = useState<TaskView>("open");

  const project = useQuery({
    queryKey: keys.projects.one(id),
    queryFn: () => api.projects.get(id),
  });
  const taskQuery: api.TaskQuery =
    taskView === "open"
      ? { projectId: id, openOnly: true }
      : taskView === "someday"
        ? { projectId: id, status: ["someday"] }
        : { projectId: id, status: ["done", "dropped"] };
  const tasks = useQuery({
    queryKey: keys.tasks.list(taskQuery),
    queryFn: () => api.tasks.list({ ...taskQuery, pageSize: 100 }),
  });
  const meetings = useQuery({
    queryKey: keys.meetings.list({ projectId: id }),
    queryFn: () => api.meetings.list({ projectId: id, pageSize: 10 }),
  });
  const requirements = useQuery({
    queryKey: keys.requirements.list({ projectId: id, openOnly: true }),
    queryFn: () =>
      api.requirements.list({ projectId: id, openOnly: true, pageSize: 20 }),
  });

  const favorite = useApiMutation(
    (favorite: boolean) => api.projects.update(id, { favorite }),
    {
      invalidate: [keys.projects.all],
    },
  );
  const remove = useApiMutation(() => api.projects.remove(id), {
    invalidate: [keys.projects.all, keys.tasks.all, keys.organizations.all],
    successMessage: "Project deleted",
    onSuccess: () => router.push("/projects"),
  });

  if (project.isLoading) return <Spinner />;
  if (project.error || !project.data)
    return <ErrorState error={project.error ?? new Error("Not found")} />;
  const p = project.data;
  const org = lookup.organization(p.organizationId);
  const scope = { organizationId: p.organizationId, projectId: p.id };

  return (
    <>
      <div className="text-fg-muted mb-4 flex items-center gap-1 text-sm">
        <Link
          href="/projects"
          className="hover:text-fg flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Projects
        </Link>
        {org && (
          <>
            <span className="mx-1">/</span>
            <Link href={`/organizations/${org.id}`} className="hover:text-fg">
              {org.name}
            </Link>
          </>
        )}
      </div>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            {p.name}
            <button
              onClick={() => favorite.mutate(!p.favorite)}
              aria-label={p.favorite ? "Unfavourite" : "Favourite"}
              className="text-fg-faint hover:text-warn"
            >
              <Star
                className={
                  p.favorite ? "fill-warn text-warn h-4 w-4" : "h-4 w-4"
                }
              />
            </button>
            {p.status !== "active" && (
              <Badge>{projectStatusLabel[p.status]}</Badge>
            )}
          </h1>
          {p.description && (
            <p className="text-fg-muted mt-0.5 max-w-xl text-sm">
              {p.description}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete"
          >
            <Trash2 className="text-danger h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-5">
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <Tabs
                value={taskView}
                onChange={setTaskView}
                options={[
                  { value: "open", label: "Open" },
                  { value: "someday", label: "Someday" },
                  { value: "done", label: "Done" },
                ]}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNewTask(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Task
              </Button>
            </div>
            {tasks.isLoading ? (
              <Spinner className="py-6" />
            ) : (
              <TaskList
                tasks={tasks.data?.items ?? []}
                showScope={false}
                showStatus={taskView === "open"}
                empty={<p className="text-fg-faint text-sm">Nothing here.</p>}
              />
            )}
          </section>

          <Card className="p-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium">
                Open requirements{" "}
                {requirements.data && requirements.data.total > 0 && (
                  <span className="text-fg-faint">
                    {requirements.data.total}
                  </span>
                )}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNewRequirement(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
            {requirements.data?.items.length ? (
              <ul className="divide-border divide-y">
                {requirements.data.items.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-2 py-2 text-sm"
                  >
                    <Badge tone="violet">{requirementTypeLabel[r.type]}</Badge>
                    <span className="min-w-0 flex-1 truncate">{r.title}</span>
                    <Badge tone="outline">
                      {requirementStatusLabel[r.status]}
                    </Badge>
                  </li>
                ))}
                <li className="pt-2 text-xs">
                  <Link
                    href={`/requirements?projectId=${id}`}
                    className="text-accent hover:underline"
                  >
                    All requirements →
                  </Link>
                </li>
              </ul>
            ) : (
              <p className="text-fg-faint text-sm">None open.</p>
            )}
          </Card>

          <Card className="p-5">
            <NotesPanel query={{ projectId: id }} defaults={scope} />
          </Card>

          <Card className="p-5">
            <AttachmentList scope={scope} query={{ projectId: id }} />
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-fg-muted text-[12px] font-medium tracking-wide uppercase">
                Meetings
              </h3>
              <button
                onClick={() => setNewMeeting(true)}
                className="text-accent text-xs font-medium hover:underline"
              >
                + New
              </button>
            </div>
            {meetings.data?.items.length ? (
              <ul className="flex flex-col">
                {meetings.data.items.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/meetings/${m.id}`}
                      className="hover:bg-surface-2 block rounded-md px-1.5 py-1.5 text-sm"
                    >
                      <p className="truncate">{m.title}</p>
                      <p className="text-fg-faint text-[11px]">
                        {formatDateTime(m.date)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-fg-faint text-sm">None yet.</p>
            )}
          </Card>
          <Card className="text-fg-muted p-4 text-xs">
            <Link
              href={`/decisions?projectId=${id}`}
              className="hover:text-fg block py-0.5"
            >
              Decisions →
            </Link>
            <Link
              href={`/notes?projectId=${id}`}
              className="hover:text-fg block py-0.5"
            >
              Notes →
            </Link>
            <p className="mt-2">Created {formatDateTime(p.createdAt)}</p>
          </Card>
        </aside>
      </div>

      <ProjectDialog
        open={editing}
        onClose={() => setEditing(false)}
        project={p}
      />
      <TaskDialog
        open={newTask}
        onClose={() => setNewTask(false)}
        defaults={{
          ...scope,
          status: taskView === "someday" ? "someday" : "next",
        }}
      />
      <RequirementDialog
        open={newRequirement}
        onClose={() => setNewRequirement(false)}
        defaults={scope}
      />
      <MeetingDialog
        open={newMeeting}
        onClose={() => setNewMeeting(false)}
        defaultScope={scope}
        onSaved={(m) => router.push(`/meetings/${m.id}`)}
      />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        destructive
        title={`Delete ${p.name}?`}
        description="Tasks filed under it are kept. Consider marking it completed or archived instead."
        confirmLabel="Delete"
      />
    </>
  );
}
