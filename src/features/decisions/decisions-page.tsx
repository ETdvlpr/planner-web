"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Gavel, Pencil, Plus, Search, Trash2 } from "lucide-react";
import * as api from "@/lib/api";
import type { Decision, UUID } from "@/lib/api";
import { keys } from "@/lib/query";
import { useApiMutation, useDebounced } from "@/lib/hooks";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Spinner,
} from "@/components/ui/misc";
import { ScopeLabel, ScopePicker } from "@/components/layout/scope-picker";
import { DecisionDialog } from "./decision-dialog";

export function DecisionsPage() {
  return (
    <Suspense>
      <DecisionsPageInner />
    </Suspense>
  );
}

function DecisionsPageInner() {
  const params = useSearchParams();
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

  const query = useMemo<api.DecisionQuery>(
    () => ({
      q: q || undefined,
      organizationId: scope.organizationId ?? undefined,
      projectId: scope.projectId ?? undefined,
      page,
      pageSize: 50,
    }),
    [q, scope, page],
  );
  const list = useQuery({
    queryKey: keys.decisions.list(query),
    queryFn: () => api.decisions.list(query),
    placeholderData: (prev) => prev,
  });

  return (
    <>
      <PageHeader
        title="Decisions"
        subtitle="What was decided, when, and why — so it is not re-litigated."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Record decision
          </Button>
        }
      >
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
      </PageHeader>

      {list.isLoading ? (
        <Spinner />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data && list.data.items.length === 0 ? (
        <EmptyState
          icon={<Gavel className="h-8 w-8" />}
          title="No decisions recorded"
        />
      ) : (
        <>
          <ol className="border-border relative flex flex-col gap-3 border-l pl-5">
            {list.data?.items.map((d) => (
              <DecisionItem key={d.id} decision={d} />
            ))}
          </ol>
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

      <DecisionDialog
        open={creating}
        onClose={() => setCreating(false)}
        defaults={scope}
      />
    </>
  );
}

function DecisionItem({ decision: d }: { decision: Decision }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = useApiMutation(() => api.decisions.remove(d.id), {
    invalidate: [keys.decisions.all],
    onSuccess: () => setConfirmDelete(false),
  });
  return (
    <li className="group border-border bg-surface shadow-card relative rounded-xl border p-4">
      <span className="border-surface bg-accent absolute top-5 -left-[26px] h-2.5 w-2.5 rounded-full border-2" />
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium whitespace-pre-wrap">
            {d.decision}
          </p>
          {d.reason && (
            <p className="text-fg-muted mt-1 text-sm whitespace-pre-wrap">
              {d.reason}
            </p>
          )}
          <div className="text-fg-faint mt-2 flex flex-wrap items-center gap-x-3 text-xs">
            <span>{formatDate(d.date)}</span>
            <ScopeLabel
              organizationId={d.organizationId}
              projectId={d.projectId}
            />
            {d.sourceMeetingId && (
              <Link
                href={`/meetings/${d.sourceMeetingId}`}
                className="text-accent hover:underline"
              >
                from meeting
              </Link>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setEditing(true)}
            aria-label="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete"
          >
            <Trash2 className="text-danger h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <DecisionDialog
        open={editing}
        onClose={() => setEditing(false)}
        decision={d}
      />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        destructive
        title="Delete decision?"
        confirmLabel="Delete"
      />
    </li>
  );
}
