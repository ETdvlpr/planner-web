"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckSquare, Plus, Search } from "lucide-react";
import * as api from "@/lib/api";
import type { TaskStatus, UUID } from "@/lib/api";
import { keys } from "@/lib/query";
import { useDebounced } from "@/lib/hooks";
import { addDays, startOfDay } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Spinner,
  Tabs,
} from "@/components/ui/misc";
import { ScopePicker } from "@/components/layout/scope-picker";
import { TaskDialog } from "./task-dialog";
import { TaskList } from "./task-row";

type View =
  "today" | "next" | "inProgress" | "waiting" | "someday" | "done" | "all";

const VIEWS: { value: View; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "next", label: "Next" },
  { value: "inProgress", label: "In progress" },
  { value: "waiting", label: "Waiting" },
  { value: "someday", label: "Someday" },
  { value: "done", label: "Done" },
  { value: "all", label: "All" },
];

/** Each view is one server query; nothing is filtered client-side. */
function queryFor(view: View): api.TaskQuery {
  switch (view) {
    case "today":
      return {
        openOnly: true,
        dueBefore: addDays(startOfDay(new Date()), 1).toISOString(),
      };
    case "all":
      return {};
    case "done":
      return { status: ["done", "dropped"] };
    default:
      return { status: [view as TaskStatus] };
  }
}

export function TasksPage() {
  const [view, setView] = useState<View>("next");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<{
    organizationId: UUID | null;
    projectId: UUID | null;
  }>({
    organizationId: null,
    projectId: null,
  });
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const q = useDebounced(search.trim());

  const query = useMemo<api.TaskQuery>(
    () => ({
      ...queryFor(view),
      q: q || undefined,
      organizationId: scope.organizationId ?? undefined,
      projectId: scope.projectId ?? undefined,
      page,
      pageSize: 50,
    }),
    [view, q, scope, page],
  );

  const tasks = useQuery({
    queryKey: keys.tasks.list(query),
    queryFn: () => api.tasks.list(query),
    placeholderData: (prev) => prev,
  });

  const change =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(1);
    };

  return (
    <>
      <PageHeader
        title="Tasks"
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            New task
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <Tabs value={view} onChange={change(setView)} options={VIEWS} />
          <div className="grid gap-2 sm:grid-cols-[1fr_minmax(0,2fr)]">
            <div className="relative">
              <Search className="text-fg-faint pointer-events-none absolute top-2.5 left-2.5 h-4 w-4" />
              <Input
                value={search}
                onChange={(e) => change(setSearch)(e.target.value)}
                placeholder="Search tasks"
                className="pl-8"
              />
            </div>
            <ScopePicker
              organizationId={scope.organizationId}
              projectId={scope.projectId}
              onChange={change(setScope)}
              compact
            />
          </div>
        </div>
      </PageHeader>

      {tasks.isLoading ? (
        <Spinner />
      ) : tasks.error ? (
        <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} />
      ) : (
        <>
          <TaskList
            tasks={tasks.data?.items ?? []}
            showStatus={view === "all" || view === "today"}
            empty={
              <EmptyState
                icon={<CheckSquare className="h-8 w-8" />}
                title={view === "today" ? "Nothing due today" : "No tasks here"}
                description={
                  q
                    ? "Nothing matches that search."
                    : view === "next"
                      ? "Move something out of the Inbox, or capture what is next."
                      : undefined
                }
              />
            }
          />
          {tasks.data && (
            <Pagination
              page={tasks.data.page}
              totalPages={tasks.data.totalPages}
              total={tasks.data.total}
              onChange={setPage}
            />
          )}
        </>
      )}

      <TaskDialog
        open={creating}
        onClose={() => setCreating(false)}
        defaults={{ ...scope, status: view === "someday" ? "someday" : "next" }}
      />
    </>
  );
}
