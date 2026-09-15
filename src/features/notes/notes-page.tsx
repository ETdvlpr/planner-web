"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, StickyNote } from "lucide-react";
import * as api from "@/lib/api";
import type { UUID } from "@/lib/api";
import { keys } from "@/lib/query";
import { useDebounced } from "@/lib/hooks";
import { formatAgo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/field";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Spinner,
} from "@/components/ui/misc";
import { ScopeLabel, ScopePicker } from "@/components/layout/scope-picker";

export function NotesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [scope, setScope] = useState<{
    organizationId: UUID | null;
    projectId: UUID | null;
  }>({
    organizationId: null,
    projectId: null,
  });
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());

  const query = useMemo<api.NoteQuery>(
    () => ({
      q: q || undefined,
      includeArchived: archived || undefined,
      organizationId: scope.organizationId ?? undefined,
      projectId: scope.projectId ?? undefined,
      page,
      pageSize: 30,
    }),
    [q, archived, scope, page],
  );
  const notes = useQuery({
    queryKey: keys.notes.list(query),
    queryFn: () => api.notes.list(query),
    placeholderData: (prev) => prev,
  });

  const newNoteHref = `/notes/new${scope.organizationId || scope.projectId ? "?" + new URLSearchParams(Object.fromEntries(Object.entries(scope).filter(([, v]) => v) as [string, string][])).toString() : ""}`;

  return (
    <>
      <PageHeader
        title="Notes"
        actions={
          <Button onClick={() => router.push(newNoteHref)}>
            <Plus className="h-4 w-4" />
            New note
          </Button>
        }
      >
        <div className="grid gap-2 sm:grid-cols-[1fr_minmax(0,2fr)_auto]">
          <div className="relative">
            <Search className="text-fg-faint pointer-events-none absolute top-2.5 left-2.5 h-4 w-4" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search notes"
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
          <label className="text-fg-muted flex items-center gap-2 text-sm">
            <Checkbox
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            Archived
          </label>
        </div>
      </PageHeader>

      {notes.isLoading ? (
        <Spinner />
      ) : notes.error ? (
        <ErrorState error={notes.error} onRetry={() => notes.refetch()} />
      ) : notes.data && notes.data.items.length === 0 ? (
        <EmptyState
          icon={<StickyNote className="h-8 w-8" />}
          title="No notes"
          description="Notes hang off tasks, meetings and projects — or stand on their own."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {notes.data?.items.map((n) => (
              <Link
                key={n.id}
                href={`/notes/${n.id}`}
                className="border-border bg-surface shadow-card hover:border-border-strong flex flex-col rounded-xl border p-4 transition-colors"
              >
                {n.title && <p className="mb-1 font-medium">{n.title}</p>}
                <p className="text-fg-muted line-clamp-5 flex-1 text-sm whitespace-pre-wrap">
                  {n.body || <span className="text-fg-faint">Empty note</span>}
                </p>
                <div className="text-fg-faint mt-3 flex items-center justify-between gap-2 text-[11px]">
                  <ScopeLabel
                    organizationId={n.organizationId}
                    projectId={n.projectId}
                  />
                  <span className="shrink-0">
                    {n.archivedAt ? "Archived · " : ""}
                    {formatAgo(n.updatedAt)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          {notes.data && (
            <Pagination
              page={notes.data.page}
              totalPages={notes.data.totalPages}
              total={notes.data.total}
              onChange={setPage}
            />
          )}
        </>
      )}
    </>
  );
}
