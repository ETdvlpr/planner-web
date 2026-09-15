"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { NotebookPen, Plus, Trash2 } from "lucide-react";
import * as api from "@/lib/api";
import type { ActivityEntry, UUID } from "@/lib/api";
import { keys } from "@/lib/query";
import { useApiMutation } from "@/lib/hooks";
import { activitySourceLabel, formatDate, formatTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Spinner,
} from "@/components/ui/misc";
import { ScopeLabel, ScopePicker } from "@/components/layout/scope-picker";

/**
 * What actually happened, in order. Task completions land here on their
 * own; anything else is logged by hand, which is the point — the unplanned
 * work is the part a task list never shows.
 */
export function ActivityPage() {
  const [text, setText] = useState("");
  const [scope, setScope] = useState<{
    organizationId: UUID | null;
    projectId: UUID | null;
  }>({
    organizationId: null,
    projectId: null,
  });
  const [page, setPage] = useState(1);

  const query = useMemo<api.ActivityQuery>(
    () => ({
      organizationId: scope.organizationId ?? undefined,
      projectId: scope.projectId ?? undefined,
      page,
      pageSize: 50,
    }),
    [scope, page],
  );
  const list = useQuery({
    queryKey: keys.activity.list(query),
    queryFn: () => api.activity.list(query),
    placeholderData: (prev) => prev,
  });
  const log = useApiMutation(
    (description: string) =>
      api.activity.create({ description, source: "manual", ...scope }),
    { invalidate: [keys.activity.all], onSuccess: () => setText("") },
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) log.mutate(text.trim());
  };

  const groups = useMemo(() => {
    const map = new Map<string, ActivityEntry[]>();
    for (const e of list.data?.items ?? []) {
      const key = formatDate(e.occurredAt);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()];
  }, [list.data]);

  return (
    <>
      <PageHeader
        title="Activity"
        subtitle="Planned and unplanned, side by side."
      >
        <Card className="p-3">
          <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Something you did that was not on the list…"
              className="flex-1"
            />
            <ScopePicker
              organizationId={scope.organizationId}
              projectId={scope.projectId}
              onChange={(s) => {
                setScope(s);
                setPage(1);
              }}
              compact
              className="sm:w-80"
            />
            <Button
              type="submit"
              loading={log.isPending}
              disabled={!text.trim()}
            >
              <Plus className="h-4 w-4" />
              Log
            </Button>
          </form>
        </Card>
      </PageHeader>

      {list.isLoading ? (
        <Spinner />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<NotebookPen className="h-8 w-8" />}
          title="Nothing logged yet"
          description="Complete a task or log something above."
        />
      ) : (
        <>
          <div className="flex flex-col gap-5">
            {groups.map(([day, entries]) => (
              <section key={day}>
                <h2 className="text-fg-muted mb-1.5 text-[12px] font-medium tracking-wide uppercase">
                  {day}
                </h2>
                <div className="divide-border border-border bg-surface divide-y rounded-xl border">
                  {entries.map((e) => (
                    <ActivityRow key={e.id} entry={e} />
                  ))}
                </div>
              </section>
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
    </>
  );
}

export function ActivityRow({ entry: e }: { entry: ActivityEntry }) {
  const remove = useApiMutation(() => api.activity.remove(e.id), {
    invalidate: [keys.activity.all],
  });
  return (
    <div className="group flex items-start gap-3 px-3 py-2">
      <span className="text-fg-faint w-14 shrink-0 pt-0.5 text-xs">
        {formatTime(e.occurredAt)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          {e.taskId ? (
            <Link href={`/tasks/${e.taskId}`} className="hover:underline">
              {e.description}
            </Link>
          ) : (
            e.description
          )}
        </p>
        <div className="text-fg-faint flex flex-wrap items-center gap-x-3 text-xs">
          <ScopeLabel
            organizationId={e.organizationId}
            projectId={e.projectId}
          />
          {e.meetingId && (
            <Link
              href={`/meetings/${e.meetingId}`}
              className="text-accent hover:underline"
            >
              meeting
            </Link>
          )}
        </div>
      </div>
      <Badge tone={e.source === "manual" ? "violet" : "ok"}>
        {activitySourceLabel[e.source]}
      </Badge>
      {e.source === "manual" && (
        <button
          onClick={() => remove.mutate()}
          className="text-fg-faint hover:text-danger p-1 opacity-0 group-hover:opacity-100"
          aria-label="Delete entry"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
