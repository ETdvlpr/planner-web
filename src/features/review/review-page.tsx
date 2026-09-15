"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import * as api from "@/lib/api";
import { keys } from "@/lib/query";
import { useLookup } from "@/lib/hooks";
import { addDays, formatDate, startOfDay } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Spinner,
} from "@/components/ui/misc";
import { ActivityRow } from "@/features/activity/activity-page";
import { TaskList } from "@/features/tasks/task-row";

/** Monday of the week containing `d`. */
function startOfWeek(d: Date): Date {
  const out = startOfDay(d);
  const day = (out.getDay() + 6) % 7;
  return addDays(out, -day);
}

/**
 * The weekly review: what got done (planned and not), what is still open
 * and overdue, and what keeps being carried forward. The numbers come from
 * `/activity/review`; the open-work lists are ordinary task queries.
 */
export function ReviewPage() {
  const lookup = useLookup();
  const [offset, setOffset] = useState(0);
  const { from, to } = useMemo(() => {
    const start = addDays(startOfWeek(new Date()), offset * 7);
    return { from: start, to: addDays(start, 7) };
  }, [offset]);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const review = useQuery({
    queryKey: keys.activity.review(fromIso, toIso),
    queryFn: () => api.activity.review(fromIso, toIso),
  });
  const overdue = useQuery({
    queryKey: keys.tasks.list({
      openOnly: true,
      dueBefore: startOfDay(new Date()).toISOString(),
      review: true,
    }),
    queryFn: () =>
      api.tasks.list({
        openOnly: true,
        dueBefore: startOfDay(new Date()).toISOString(),
        pageSize: 50,
      }),
  });
  const waiting = useQuery({
    queryKey: keys.tasks.list({ status: ["waiting"], review: true }),
    queryFn: () => api.tasks.list({ status: ["waiting"], pageSize: 50 }),
  });
  const inbox = useQuery({
    queryKey: keys.tasks.list({ status: ["inbox"], review: true }),
    queryFn: () => api.tasks.list({ status: ["inbox"], pageSize: 1 }),
  });

  const r = review.data;
  const isThisWeek = offset === 0;

  return (
    <>
      <PageHeader
        title="Weekly review"
        subtitle={`${formatDate(fromIso)} – ${formatDate(addDays(to, -1).toISOString())}`}
        actions={
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setOffset((o) => o - 1)}
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(0)}
              disabled={isThisWeek}
            >
              This week
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setOffset((o) => o + 1)}
              disabled={isThisWeek}
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {review.isLoading ? (
        <Spinner />
      ) : review.error ? (
        <ErrorState error={review.error} onRetry={() => review.refetch()} />
      ) : r ? (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Done" value={r.totals.all} />
            <Stat
              label="Planned"
              value={r.totals.planned}
              hint="task completions"
            />
            <Stat
              label="Unplanned"
              value={r.totals.unplanned}
              hint="logged by hand"
              tone={r.totals.unplanned > r.totals.planned ? "warn" : undefined}
            />
            <Stat
              label="Carried forward"
              value={r.totals.carriedForward}
              tone={r.totals.carriedForward > 3 ? "warn" : undefined}
            />
          </div>

          {r.byOrganization.length > 0 && (
            <Card className="p-4">
              <h2 className="mb-2 text-sm font-medium">Where the week went</h2>
              <div className="flex flex-col gap-1.5">
                {[...r.byOrganization]
                  .sort((a, b) => b.count - a.count)
                  .map((row) => {
                    const org = lookup.organization(row.organizationId);
                    const pct = r.totals.all
                      ? (row.count / r.totals.all) * 100
                      : 0;
                    return (
                      <div
                        key={row.organizationId ?? "unfiled"}
                        className="flex items-center gap-3 text-sm"
                      >
                        <span className="w-40 truncate">
                          {org ? (
                            <Link
                              href={`/organizations/${org.id}`}
                              className="hover:underline"
                            >
                              {org.name}
                            </Link>
                          ) : (
                            <span className="text-fg-muted">Unfiled</span>
                          )}
                        </span>
                        <div className="bg-surface-2 h-2 flex-1 overflow-hidden rounded-full">
                          <div
                            className="bg-accent h-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-fg-muted w-8 text-right text-xs">
                          {row.count}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </Card>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-4">
              <h2 className="mb-2 text-sm font-medium">
                Planned{" "}
                <span className="text-fg-faint">{r.planned.length}</span>
              </h2>
              {r.planned.length === 0 ? (
                <p className="text-fg-faint text-sm">
                  No tasks completed this week.
                </p>
              ) : (
                <div className="divide-border -mx-3 divide-y">
                  {r.planned.map((e) => (
                    <ActivityRow key={e.id} entry={e} />
                  ))}
                </div>
              )}
            </Card>
            <Card className="p-4">
              <h2 className="mb-2 text-sm font-medium">
                Unplanned{" "}
                <span className="text-fg-faint">{r.unplanned.length}</span>
              </h2>
              {r.unplanned.length === 0 ? (
                <p className="text-fg-faint text-sm">
                  Nothing logged by hand. Was the week really that tidy?
                </p>
              ) : (
                <div className="divide-border -mx-3 divide-y">
                  {r.unplanned.map((e) => (
                    <ActivityRow key={e.id} entry={e} />
                  ))}
                </div>
              )}
            </Card>
          </div>

          {isThisWeek && (
            <>
              <section>
                <h2 className="mb-2 text-sm font-medium">
                  Overdue{" "}
                  <span className="text-fg-faint">
                    {overdue.data?.total ?? ""}
                  </span>
                </h2>
                {overdue.isLoading ? (
                  <Spinner className="py-4" />
                ) : (
                  <TaskList
                    tasks={overdue.data?.items ?? []}
                    showStatus
                    empty={
                      <p className="text-fg-faint text-sm">
                        Nothing overdue. Carry forward or drop what you will not
                        do.
                      </p>
                    }
                  />
                )}
              </section>
              <section>
                <h2 className="mb-2 text-sm font-medium">
                  Waiting on others{" "}
                  <span className="text-fg-faint">
                    {waiting.data?.total ?? ""}
                  </span>
                </h2>
                {waiting.isLoading ? (
                  <Spinner className="py-4" />
                ) : (
                  <TaskList
                    tasks={waiting.data?.items ?? []}
                    empty={
                      <p className="text-fg-faint text-sm">
                        Nothing blocked on someone else.
                      </p>
                    }
                  />
                )}
              </section>
              {inbox.data && inbox.data.total > 0 && (
                <Card className="flex items-center justify-between p-4 text-sm">
                  <span>
                    <strong>{inbox.data.total}</strong> item
                    {inbox.data.total === 1 ? "" : "s"} still in the Inbox.
                  </span>
                  <Link
                    href="/inbox"
                    className="text-accent font-medium hover:underline"
                  >
                    Sort them →
                  </Link>
                </Card>
              )}
            </>
          )}
        </div>
      ) : (
        <EmptyState
          icon={<CalendarClock className="h-8 w-8" />}
          title="No review data"
        />
      )}
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "warn";
}) {
  return (
    <Card className="px-4 py-3">
      <p
        className={
          "text-2xl font-semibold tracking-tight " +
          (tone === "warn" ? "text-warn" : "")
        }
      >
        {value}
      </p>
      <p className="text-fg-muted text-xs">
        {label}
        {hint && <span className="text-fg-faint"> · {hint}</span>}
      </p>
    </Card>
  );
}
