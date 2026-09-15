"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Plus, Search } from "lucide-react";
import * as api from "@/lib/api";
import {
  REQUIREMENT_STATUSES,
  type Requirement,
  type RequirementStatus,
  type UUID,
} from "@/lib/api";
import { keys } from "@/lib/query";
import { useApiMutation, useDebounced } from "@/lib/hooks";
import {
  formatAgo,
  requirementStatusLabel,
  requirementTypeLabel,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  Badge,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Spinner,
  Tabs,
} from "@/components/ui/misc";
import { ScopeLabel, ScopePicker } from "@/components/layout/scope-picker";
import { TaskDialog } from "@/features/tasks/task-dialog";
import { RequirementDialog } from "./requirement-dialog";

type View = "open" | "implemented" | "rejected" | "all";

const statusTone: Record<
  RequirementStatus,
  "neutral" | "accent" | "ok" | "danger" | "violet"
> = {
  unreviewed: "neutral",
  accepted: "accent",
  planned: "violet",
  implemented: "ok",
  rejected: "danger",
};

export function RequirementsPage() {
  return (
    <Suspense>
      <RequirementsPageInner />
    </Suspense>
  );
}

function RequirementsPageInner() {
  const params = useSearchParams();
  const [view, setView] = useState<View>("open");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<{
    organizationId: UUID | null;
    projectId: UUID | null;
  }>({
    organizationId: params.get("organizationId"),
    projectId: params.get("projectId"),
  });
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const q = useDebounced(search.trim());

  const query = useMemo<api.RequirementQuery>(
    () => ({
      openOnly: view === "open" || undefined,
      status: view === "implemented" || view === "rejected" ? view : undefined,
      q: q || undefined,
      organizationId: scope.organizationId ?? undefined,
      projectId: scope.projectId ?? undefined,
      page,
      pageSize: 50,
    }),
    [view, q, scope, page],
  );
  const list = useQuery({
    queryKey: keys.requirements.list(query),
    queryFn: () => api.requirements.list(query),
    placeholderData: (prev) => prev,
  });

  return (
    <>
      <PageHeader
        title="Requirements"
        subtitle="Features, ideas, questions and investigations — what came out of meetings."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            New requirement
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <Tabs
            value={view}
            onChange={(v) => {
              setView(v);
              setPage(1);
            }}
            options={[
              { value: "open", label: "Open" },
              { value: "implemented", label: "Implemented" },
              { value: "rejected", label: "Rejected" },
              { value: "all", label: "All" },
            ]}
          />
          <div className="grid gap-2 sm:grid-cols-[1fr_minmax(0,2fr)]">
            <div className="relative">
              <Search className="text-fg-faint pointer-events-none absolute top-2.5 left-2.5 h-4 w-4" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search"
                className="pl-8"
              />
            </div>
            <ScopePicker
              organizationId={scope.organizationId}
              projectId={scope.projectId}
              onChange={(s) => {
                setScope(s);
                setPage(1);
              }}
              compact
            />
          </div>
        </div>
      </PageHeader>

      {list.isLoading ? (
        <Spinner />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data && list.data.items.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title="No requirements"
          description="Process a meeting's notes and the features, ideas and questions land here."
        />
      ) : (
        <>
          <div className="divide-border border-border bg-surface divide-y rounded-xl border">
            {list.data?.items.map((r) => (
              <RequirementRow key={r.id} requirement={r} />
            ))}
          </div>
          {list.data && (
            <Pagination
              page={list.data.page}
              totalPages={list.data.totalPages}
              total={list.data.total}
              onChange={setPage}
            />
          )}
        </>
      )}

      <RequirementDialog
        open={creating}
        onClose={() => setCreating(false)}
        defaults={scope}
      />
    </>
  );
}

function RequirementRow({ requirement: r }: { requirement: Requirement }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [toTask, setToTask] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const setStatus = useApiMutation(
    (status: RequirementStatus) => api.requirements.update(r.id, { status }),
    { invalidate: [keys.requirements.all] },
  );
  const remove = useApiMutation(() => api.requirements.remove(r.id), {
    invalidate: [keys.requirements.all],
    onSuccess: () => setConfirmDelete(false),
  });

  return (
    <div className="px-3 py-2.5">
      <div className="flex items-start gap-3">
        <Badge tone="violet" className="mt-0.5">
          {requirementTypeLabel[r.type]}
        </Badge>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="text-sm">{r.title}</p>
          <div className="text-fg-faint mt-0.5 flex flex-wrap items-center gap-x-3 text-xs">
            <ScopeLabel
              organizationId={r.organizationId}
              projectId={r.projectId}
            />
            <span>{formatAgo(r.createdAt)}</span>
            {r.sourceMeetingId && (
              <span
                role="link"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/meetings/${r.sourceMeetingId}`);
                }}
                className="text-accent hover:underline"
              >
                from meeting
              </span>
            )}
          </div>
        </button>
        <Select
          value={r.status}
          onChange={(e) =>
            setStatus.mutate(e.target.value as RequirementStatus)
          }
          className="h-7 w-auto text-xs"
          aria-label="Status"
        >
          {REQUIREMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {requirementStatusLabel[s]}
            </option>
          ))}
        </Select>
        <Badge
          tone={statusTone[r.status]}
          className="mt-1 hidden sm:inline-flex"
        >
          {requirementStatusLabel[r.status]}
        </Badge>
      </div>
      {expanded && (
        <div className="border-border mt-2 ml-1 flex flex-col gap-2 border-l-2 pl-3">
          {r.description ? (
            <p className="text-fg-muted text-sm whitespace-pre-wrap">
              {r.description}
            </p>
          ) : (
            <p className="text-fg-faint text-xs">No description.</p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => setToTask(true)}>
              Create task from this
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-danger"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          </div>
        </div>
      )}
      <RequirementDialog
        open={editing}
        onClose={() => setEditing(false)}
        requirement={r}
      />
      <TaskDialog
        open={toTask}
        onClose={() => setToTask(false)}
        defaults={{
          title: r.title,
          organizationId: r.organizationId,
          projectId: r.projectId,
          sourceRequirementId: r.id,
          status: "next",
        }}
        onSaved={() => setStatus.mutate("planned")}
      />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        destructive
        title="Delete requirement?"
        confirmLabel="Delete"
      />
    </div>
  );
}
