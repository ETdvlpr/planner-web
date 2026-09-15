"use client";

import { useState, type FormEvent } from "react";
import * as api from "@/lib/api";
import { PROJECT_STATUSES, type Project, type UUID } from "@/lib/api";
import { keys } from "@/lib/query";
import { useApiMutation, useLookup } from "@/lib/hooks";
import { projectStatusLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogFooter } from "@/components/ui/dialog";
import {
  Checkbox,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/field";

export function ProjectDialog({
  open,
  onClose,
  project,
  defaultOrganizationId = null,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  project?: Project;
  defaultOrganizationId?: UUID | null;
  onSaved?: (project: Project) => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={project ? "Edit project" : "New project"}
    >
      <ProjectDialogForm
        onClose={onClose}
        project={project}
        defaultOrganizationId={defaultOrganizationId}
        onSaved={onSaved}
      />
    </Dialog>
  );
}

function ProjectDialogForm({
  onClose,
  project,
  defaultOrganizationId = null,
  onSaved,
}: {
  onClose: () => void;
  project?: Project;
  defaultOrganizationId?: UUID | null;
  onSaved?: (project: Project) => void;
}) {
  const lookup = useLookup();
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [organizationId, setOrganizationId] = useState<UUID | null>(
    project?.organizationId ?? defaultOrganizationId,
  );
  const [status, setStatus] = useState<Project["status"]>(
    project?.status ?? "active",
  );
  const [favorite, setFavorite] = useState(project?.favorite ?? false);

  const save = useApiMutation(
    (input: api.ProjectInput) =>
      project
        ? api.projects.update(project.id, input)
        : api.projects.create(input),
    {
      invalidate: [keys.projects.all, keys.organizations.all],
      onSuccess: (saved) => {
        onSaved?.(saved);
        onClose();
      },
    },
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    save.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      organizationId,
      status,
      favorite,
    });
  };

  return (
    <>
      <DialogBody>
        <form
          id="project-form"
          onSubmit={submit}
          className="flex flex-col gap-4"
        >
          <Field label="Name" htmlFor="project-name">
            <Input
              id="project-name"
              autoFocus
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Planner backend"
            />
          </Field>
          <Field label="Organization" htmlFor="project-org">
            <Select
              id="project-org"
              value={organizationId ?? ""}
              onChange={(e) => setOrganizationId(e.target.value || null)}
            >
              <option value="">No organization</option>
              {lookup.organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description" htmlFor="project-description">
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status" htmlFor="project-status">
              <Select
                id="project-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as Project["status"])}
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {projectStatusLabel[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <Checkbox
                checked={favorite}
                onChange={(e) => setFavorite(e.target.checked)}
              />
              Favourite
            </label>
          </div>
        </form>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form="project-form" loading={save.isPending}>
          {project ? "Save" : "Create"}
        </Button>
      </DialogFooter>
    </>
  );
}
