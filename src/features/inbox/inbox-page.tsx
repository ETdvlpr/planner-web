"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Inbox, Plus } from "lucide-react";
import * as api from "@/lib/api";
import { keys } from "@/lib/query";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Spinner,
} from "@/components/ui/misc";
import { TaskDialog } from "@/features/tasks/task-dialog";
import { TaskList } from "@/features/tasks/task-row";

/**
 * Everything captured and not yet filed. Filing happens from the row
 * (edit → pick an organization or project), which moves the task out of
 * here on its own since the list is a server query.
 */
export function InboxPage() {
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const query: api.TaskQuery = { status: ["inbox"], page, pageSize: 50 };
  const tasks = useQuery({
    queryKey: keys.tasks.list(query),
    queryFn: () => api.tasks.list(query),
  });

  return (
    <>
      <PageHeader
        title="Inbox"
        subtitle={
          tasks.data ? `${tasks.data.total} to sort` : "Captured, not yet filed"
        }
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            New task
          </Button>
        }
      />

      {tasks.isLoading ? (
        <Spinner />
      ) : tasks.error ? (
        <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} />
      ) : (
        <>
          <TaskList
            tasks={tasks.data?.items ?? []}
            showScope={false}
            empty={
              <EmptyState
                icon={<Inbox className="h-8 w-8" />}
                title="Inbox zero"
                description="Everything you captured has been filed. Capture more, or go do the work."
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

      <TaskDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
