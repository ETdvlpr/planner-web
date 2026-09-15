import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";

/**
 * Cloud-first, so the server is the truth and the cache is a convenience.
 * A short `staleTime` keeps navigation snappy without showing yesterday's
 * inbox; mutations invalidate by resource key, which refetches whatever is
 * on screen.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: (count, error) => {
          // A 4xx will not get better by asking again.
          if (error instanceof ApiError && error.status < 500) return false;
          return count < 2;
        },
      },
    },
  });
}

/**
 * Query keys, one namespace per resource. Invalidating `keys.tasks.all`
 * refetches every task list and detail at once, which is the right blast
 * radius for "something about tasks changed".
 */
export const keys = {
  me: ["me"] as const,
  organizations: {
    all: ["organizations"] as const,
    list: (q: unknown) => ["organizations", "list", q] as const,
    one: (id: string) => ["organizations", "one", id] as const,
    summary: (id: string) => ["organizations", "summary", id] as const,
  },
  projects: {
    all: ["projects"] as const,
    list: (q: unknown) => ["projects", "list", q] as const,
    one: (id: string) => ["projects", "one", id] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    list: (q: unknown) => ["tasks", "list", q] as const,
    one: (id: string) => ["tasks", "one", id] as const,
    checklist: (id: string) => ["tasks", "checklist", id] as const,
    series: (id: string) => ["tasks", "series", id] as const,
  },
  meetings: {
    all: ["meetings"] as const,
    list: (q: unknown) => ["meetings", "list", q] as const,
    one: (id: string) => ["meetings", "one", id] as const,
    status: (id: string) => ["meetings", "status", id] as const,
    noteItems: (id: string) => ["meetings", "note-items", id] as const,
  },
  requirements: {
    all: ["requirements"] as const,
    list: (q: unknown) => ["requirements", "list", q] as const,
    one: (id: string) => ["requirements", "one", id] as const,
  },
  notes: {
    all: ["notes"] as const,
    list: (q: unknown) => ["notes", "list", q] as const,
    one: (id: string) => ["notes", "one", id] as const,
  },
  decisions: {
    all: ["decisions"] as const,
    list: (q: unknown) => ["decisions", "list", q] as const,
  },
  activity: {
    all: ["activity"] as const,
    list: (q: unknown) => ["activity", "list", q] as const,
    review: (from?: string, to?: string) =>
      ["activity", "review", from ?? null, to ?? null] as const,
  },
  attachments: {
    all: ["attachments"] as const,
    list: (q: unknown) => ["attachments", "list", q] as const,
    url: (id: string) => ["attachments", "url", id] as const,
  },
};
