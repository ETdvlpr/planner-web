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
  orgStatusLabel,
  projectStatusLabel,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Badge, Card, ErrorState, Spinner } from "@/components/ui/misc";
import { TaskList } from "@/features/tasks/task-row";
import { TaskDialog } from "@/features/tasks/task-dialog";
import { ProjectDialog } from "@/features/projects/project-dialog";
import { MeetingDialog } from "@/features/meetings/meeting-dialog";
import { OrganizationDialog } from "./organization-dialog";

export function OrganizationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const lookup = useLookup();
  const [editing, setEditing] = useState(false);
  const [newProject, setNewProject] = useState(false);
  const [newTask, setNewTask] = useState(false);
  const [newMeeting, setNewMeeting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const summary = useQuery({
    queryKey: keys.organizations.summary(id),
    queryFn: () => api.organizations.summary(id),
  });
  const tasks = useQuery({
    queryKey: keys.tasks.list({ organizationId: id, openOnly: true }),
    queryFn: () =>
      api.tasks.list({ organizationId: id, openOnly: true, pageSize: 100 }),
  });
  const meetings = useQuery({
    queryKey: keys.meetings.list({ organizationId: id }),
    queryFn: () => api.meetings.list({ organizationId: id, pageSize: 10 }),
  });

  const favorite = useApiMutation(
    (favorite: boolean) => api.organizations.update(id, { favorite }),
    { invalidate: [keys.organizations.all] },
  );
  const remove = useApiMutation(() => api.organizations.remove(id), {
    invalidate: [keys.organizations.all, keys.projects.all, keys.tasks.all],
    successMessage: "Organization deleted",
    onSuccess: () => router.push("/organizations"),
  });

  if (summary.isLoading) return <Spinner />;
  if (summary.error || !summary.data) {
    return <ErrorState error={summary.error ?? new Error("Not found")} />;
  }
  const { organization: org, counts } = summary.data;
  const projects = lookup.projectsOf(id);

  return (
    <>
      <div className="text-fg-muted mb-4 text-sm">
        <Link
          href="/organizations"
          className="hover:text-fg flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Organizations
        </Link>
      </div>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="bg-accent-soft text-accent flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-semibold">
            {org.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              {org.name}
              <button
                onClick={() => favorite.mutate(!org.favorite)}
                aria-label={org.favorite ? "Unfavourite" : "Favourite"}
                className="text-fg-faint hover:text-warn"
              >
                <Star
                  className={
                    org.favorite ? "fill-warn text-warn h-4 w-4" : "h-4 w-4"
                  }
                />
              </button>
              {org.status !== "active" && (
                <Badge>{orgStatusLabel[org.status]}</Badge>
              )}
            </h1>
            {org.description && (
              <p className="text-fg-muted mt-0.5 max-w-xl text-sm">
                {org.description}
              </p>
            )}
          </div>
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

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Projects" value={counts.projects} />
        <Stat label="Open tasks" value={counts.openTasks} />
        <Stat label="Meetings" value={counts.meetings} />
        <Stat label="Open requirements" value={counts.openRequirements} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-5">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium">Open tasks</h2>
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
                showStatus
                empty={<p className="text-fg-faint text-sm">No open tasks.</p>}
              />
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-fg-muted text-[12px] font-medium tracking-wide uppercase">
                Projects
              </h3>
              <button
                onClick={() => setNewProject(true)}
                className="text-accent text-xs font-medium hover:underline"
              >
                + New
              </button>
            </div>
            {projects.length === 0 ? (
              <p className="text-fg-faint text-sm">None yet.</p>
            ) : (
              <ul className="flex flex-col">
                {projects.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}`}
                      className="hover:bg-surface-2 flex items-center justify-between gap-2 rounded-md px-1.5 py-1.5 text-sm"
                    >
                      <span className="truncate">{p.name}</span>
                      {p.status !== "active" && (
                        <Badge tone="outline">
                          {projectStatusLabel[p.status]}
                        </Badge>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-fg-muted text-[12px] font-medium tracking-wide uppercase">
                Recent meetings
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
              href={`/requirements?organizationId=${id}`}
              className="hover:text-fg block py-0.5"
            >
              Requirements →
            </Link>
            <Link
              href={`/decisions?organizationId=${id}`}
              className="hover:text-fg block py-0.5"
            >
              Decisions →
            </Link>
            <Link
              href={`/notes?organizationId=${id}`}
              className="hover:text-fg block py-0.5"
            >
              Notes →
            </Link>
          </Card>
        </aside>
      </div>

      <OrganizationDialog
        open={editing}
        onClose={() => setEditing(false)}
        organization={org}
      />
      <ProjectDialog
        open={newProject}
        onClose={() => setNewProject(false)}
        defaultOrganizationId={id}
      />
      <TaskDialog
        open={newTask}
        onClose={() => setNewTask(false)}
        defaults={{ organizationId: id, status: "next" }}
      />
      <MeetingDialog
        open={newMeeting}
        onClose={() => setNewMeeting(false)}
        defaultScope={{ organizationId: id, projectId: null }}
        onSaved={(m) => router.push(`/meetings/${m.id}`)}
      />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        destructive
        title={`Delete ${org.name}?`}
        description="Projects and tasks filed under it are kept and resolve to the Inbox. Consider archiving instead."
        confirmLabel="Delete"
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-fg-muted text-xs">{label}</p>
    </Card>
  );
}
