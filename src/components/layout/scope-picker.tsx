"use client";

import { Select } from "@/components/ui/field";
import { useLookup } from "@/lib/hooks";
import type { UUID } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Organization + project pickers that agree with each other: choosing a
 * project fills in its organization, and changing the organization clears a
 * project that does not belong to it. Both empty means "Inbox", which is a
 * deliberate, valid choice.
 */
export function ScopePicker({
  organizationId,
  projectId,
  onChange,
  className,
  compact = false,
}: {
  organizationId: UUID | null;
  projectId: UUID | null;
  onChange: (scope: {
    organizationId: UUID | null;
    projectId: UUID | null;
  }) => void;
  className?: string;
  compact?: boolean;
}) {
  const lookup = useLookup();
  const projects = organizationId
    ? lookup.projectsOf(organizationId)
    : lookup.projects;

  return (
    <div
      className={cn(
        "grid gap-2",
        compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2",
        className,
      )}
    >
      <Select
        value={organizationId ?? ""}
        onChange={(e) => {
          const next = e.target.value || null;
          const keepProject =
            projectId && lookup.project(projectId)?.organizationId === next;
          onChange({
            organizationId: next,
            projectId: keepProject ? projectId : null,
          });
        }}
        aria-label="Organization"
      >
        <option value="">No organization</option>
        {lookup.organizations
          .filter((o) => o.status !== "archived" || o.id === organizationId)
          .map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
      </Select>
      <Select
        value={projectId ?? ""}
        onChange={(e) => {
          const next = e.target.value || null;
          const project = lookup.project(next);
          onChange({
            organizationId: project?.organizationId ?? organizationId,
            projectId: next,
          });
        }}
        aria-label="Project"
      >
        <option value="">No project</option>
        {projects
          .filter((p) => p.status !== "archived" || p.id === projectId)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
      </Select>
    </div>
  );
}

/** "Infnova · Planner backend" — the breadcrumb for any scoped row. */
export function ScopeLabel({
  organizationId,
  projectId,
  className,
}: {
  organizationId: UUID | null;
  projectId: UUID | null;
  className?: string;
}) {
  const lookup = useLookup();
  const org = lookup.organization(organizationId);
  const project = lookup.project(projectId);
  if (!org && !project) return null;
  return (
    <span className={cn("text-fg-faint truncate text-xs", className)}>
      {[org?.name, project?.name].filter(Boolean).join(" · ")}
    </span>
  );
}
