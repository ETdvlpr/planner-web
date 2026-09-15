"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Plus, Star } from "lucide-react";
import type { OrgStatus } from "@/lib/api";
import { useOrganizations } from "@/lib/hooks";
import { orgStatusLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Badge,
  EmptyState,
  ErrorState,
  PageHeader,
  Spinner,
  Tabs,
} from "@/components/ui/misc";
import { OrganizationDialog } from "./organization-dialog";

type View = "active" | "paused" | "archived";

export function OrganizationsPage() {
  const orgs = useOrganizations();
  const [view, setView] = useState<View>("active");
  const [creating, setCreating] = useState(false);

  const items = (orgs.data ?? [])
    .filter((o) => o.status === view)
    .sort(
      (a, b) =>
        Number(b.favorite) - Number(a.favorite) ||
        a.sortOrder - b.sortOrder ||
        a.name.localeCompare(b.name),
    );
  const count = (s: OrgStatus) =>
    orgs.data?.filter((o) => o.status === s).length;

  return (
    <>
      <PageHeader
        title="Organizations"
        subtitle="The clients, employers and ventures your work belongs to."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            New organization
          </Button>
        }
      >
        <Tabs
          value={view}
          onChange={setView}
          options={[
            { value: "active", label: "Active", count: count("active") },
            { value: "paused", label: "Paused", count: count("paused") },
            { value: "archived", label: "Archived", count: count("archived") },
          ]}
        />
      </PageHeader>

      {orgs.isLoading ? (
        <Spinner />
      ) : orgs.error ? (
        <ErrorState error={orgs.error} onRetry={() => orgs.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title={
            view === "active"
              ? "No organizations yet"
              : `Nothing ${orgStatusLabel[view].toLowerCase()}`
          }
          description={
            view === "active"
              ? "An organization groups projects, meetings and tasks. Start with the one you spend the most time on."
              : undefined
          }
          action={
            view === "active" && (
              <Button onClick={() => setCreating(true)}>
                Create the first one
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((o) => (
            <Link
              key={o.id}
              href={`/organizations/${o.id}`}
              className="border-border bg-surface shadow-card hover:border-border-strong flex flex-col gap-2 rounded-xl border p-4 transition-colors"
            >
              <div className="flex items-start gap-2">
                <div className="bg-accent-soft text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold">
                  {o.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-medium">
                    <span className="truncate">{o.name}</span>
                    {o.favorite && (
                      <Star className="fill-warn text-warn h-3.5 w-3.5 shrink-0" />
                    )}
                  </p>
                  {o.description && (
                    <p className="text-fg-muted line-clamp-2 text-xs">
                      {o.description}
                    </p>
                  )}
                </div>
              </div>
              {o.status !== "active" && (
                <Badge>{orgStatusLabel[o.status]}</Badge>
              )}
            </Link>
          ))}
        </div>
      )}

      <OrganizationDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
