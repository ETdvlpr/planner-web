"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Users } from "lucide-react";
import * as api from "@/lib/api";
import type { UUID } from "@/lib/api";
import { keys } from "@/lib/query";
import { useDebounced } from "@/lib/hooks";
import { formatDate, formatTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Spinner,
} from "@/components/ui/misc";
import { ScopeLabel, ScopePicker } from "@/components/layout/scope-picker";
import { MeetingDialog } from "./meeting-dialog";

export function MeetingsPage() {
  const router = useRouter();
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

  const query = useMemo<api.MeetingQuery>(
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
    queryKey: keys.meetings.list(query),
    queryFn: () => api.meetings.list(query),
    placeholderData: (prev) => prev,
  });

  // Group by day for scanning.
  const groups = useMemo(() => {
    const map = new Map<string, api.Meeting[]>();
    for (const m of list.data?.items ?? []) {
      const key = formatDate(m.date);
      map.set(key, [...(map.get(key) ?? []), m]);
    }
    return [...map.entries()];
  }, [list.data]);

  return (
    <>
      <PageHeader
        title="Meetings"
        subtitle="Raw notes in, structured work out."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            New meeting
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
              placeholder="Search meetings"
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
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No meetings"
          description="Start one when the call begins; paste screenshots and type raw notes as it happens."
          action={
            <Button onClick={() => setCreating(true)}>New meeting</Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-5">
            {groups.map(([day, items]) => (
              <section key={day}>
                <h2 className="text-fg-muted mb-1.5 text-[12px] font-medium tracking-wide uppercase">
                  {day}
                </h2>
                <div className="divide-border border-border bg-surface divide-y rounded-xl border">
                  {items.map((m) => (
                    <Link
                      key={m.id}
                      href={`/meetings/${m.id}`}
                      className="hover:bg-surface-2 flex items-center gap-3 px-3 py-2.5 transition-colors first:rounded-t-xl last:rounded-b-xl"
                    >
                      <span className="text-fg-faint w-14 shrink-0 text-xs">
                        {formatTime(m.date)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {m.title}
                        </p>
                        <div className="text-fg-faint flex flex-wrap gap-x-3 text-xs">
                          <ScopeLabel
                            organizationId={m.organizationId}
                            projectId={m.projectId}
                          />
                          {m.attendees && (
                            <span className="truncate">{m.attendees}</span>
                          )}
                        </div>
                      </div>
                      {m.rawNotes && (
                        <span className="text-fg-faint hidden max-w-xs truncate text-xs sm:block">
                          {m.rawNotes.split("\n")[0]}
                        </span>
                      )}
                    </Link>
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

      <MeetingDialog
        open={creating}
        onClose={() => setCreating(false)}
        defaultScope={scope}
        onSaved={(m) => router.push(`/meetings/${m.id}`)}
      />
    </>
  );
}
