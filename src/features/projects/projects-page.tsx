"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderKanban, Plus, Star } from "lucide-react";
import type { ProjectStatus } from "@/lib/api";
import { useLookup } from "@/lib/hooks";
import { projectStatusLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Badge,
  EmptyState,
  ErrorState,
  PageHeader,
  Spinner,
  Tabs,
} from "@/components/ui/misc";
import { ProjectDialog } from "./project-dialog";
import { useProjects } from "@/lib/hooks";

type View = "active" | "paused" | "completed" | "archived";

export function ProjectsPage() {
  const projects = useProjects();
  const lookup = useLookup();
  const [view, setView] = useState<View>("active");
  const [creating, setCreating] = useState(false);

  const items = (projects.data ?? [])
    .filter((p) => p.status === view)
    .sort(
      (a, b) =>
        Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name),
    );
  const count = (s: ProjectStatus) =>
    projects.data?.filter((p) => p.status === s).length;

  // Group by organization so the list reads as a map of the work.
  const groups = new Map<string | null, typeof items>();
  for (const p of items) {
    const list = groups.get(p.organizationId) ?? [];
    list.push(p);
    groups.set(p.organizationId, list);
  }

  return (
    <>
      <PageHeader
        title="Projects"
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            New project
          </Button>
        }
      >
        <Tabs
          value={view}
          onChange={setView}
          options={[
            { value: "active", label: "Active", count: count("active") },
            { value: "paused", label: "Paused", count: count("paused") },
            {
              value: "completed",
              label: "Completed",
              count: count("completed"),
            },
            { value: "archived", label: "Archived", count: count("archived") },
          ]}
        />
      </PageHeader>

      {projects.isLoading ? (
        <Spinner />
      ) : projects.error ? (
        <ErrorState error={projects.error} onRetry={() => projects.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-8 w-8" />}
          title={`No ${projectStatusLabel[view].toLowerCase()} projects`}
          description={
            view === "active"
              ? "A project is a bounded piece of work with an end. Tasks and meetings file under it."
              : undefined
          }
          action={
            view === "active" && (
              <Button onClick={() => setCreating(true)}>New project</Button>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {[...groups.entries()].map(([orgId, list]) => {
            const org = lookup.organization(orgId);
            return (
              <section key={orgId ?? "none"}>
                <h2 className="text-fg-muted mb-2 text-[12px] font-medium tracking-wide uppercase">
                  {org ? (
                    <Link
                      href={`/organizations/${org.id}`}
                      className="hover:text-fg"
                    >
                      {org.name}
                    </Link>
                  ) : (
                    "No organization"
                  )}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((p) => (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      className="border-border bg-surface shadow-card hover:border-border-strong rounded-xl border p-4 transition-colors"
                    >
                      <p className="flex items-center gap-1.5 font-medium">
                        <span className="truncate">{p.name}</span>
                        {p.favorite && (
                          <Star className="fill-warn text-warn h-3.5 w-3.5 shrink-0" />
                        )}
                      </p>
                      {p.description && (
                        <p className="text-fg-muted mt-1 line-clamp-2 text-xs">
                          {p.description}
                        </p>
                      )}
                      {p.status !== "active" && (
                        <Badge className="mt-2">
                          {projectStatusLabel[p.status]}
                        </Badge>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <ProjectDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
