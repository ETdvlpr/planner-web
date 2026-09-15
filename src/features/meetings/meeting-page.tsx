"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ListChecks,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Users,
  Wand2,
  X,
} from "lucide-react";
import * as api from "@/lib/api";
import type { Meeting, MeetingNoteItem, ProcessedItemKind } from "@/lib/api";
import { keys } from "@/lib/query";
import { useApiMutation, useAutosave, useLookup } from "@/lib/hooks";
import { formatDateTime, processedKindLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Badge, Card, ErrorState, Spinner } from "@/components/ui/misc";
import { AttachmentList } from "@/features/attachments/attachment-list";
import { NotesPanel } from "@/features/notes/notes-panel";
import { TaskList } from "@/features/tasks/task-row";
import { MeetingDialog } from "./meeting-dialog";
import {
  ProcessDialog,
  createsRequirement,
  createsTask,
} from "./process-dialog";
import { cn } from "@/lib/utils";

/**
 * A meeting is raw notes plus what they became.
 *
 * The raw notes autosave and are never rewritten by processing. "Split"
 * derives one note item per line; each item is then turned into a task,
 * requirement, decision or note, or dismissed. Screenshots pasted anywhere
 * on this page attach to the meeting.
 */
export function MeetingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const lookup = useLookup();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRebuild, setConfirmRebuild] = useState(false);
  const [processing, setProcessing] = useState<MeetingNoteItem | "new" | null>(
    null,
  );

  const meeting = useQuery({
    queryKey: keys.meetings.one(id),
    queryFn: () => api.meetings.get(id),
  });
  const items = useQuery({
    queryKey: keys.meetings.noteItems(id),
    queryFn: () => api.meetings.noteItems(id),
  });
  const tasks = useQuery({
    queryKey: keys.tasks.list({ sourceMeetingId: id }),
    // The task list filter has no sourceMeetingId; fetch open work for the
    // meeting's project and narrow here. Small lists, so this is fine.
    queryFn: async () => {
      const page = await api.tasks.list({
        projectId: meeting.data?.projectId ?? undefined,
        organizationId: meeting.data?.projectId
          ? undefined
          : (meeting.data?.organizationId ?? undefined),
        pageSize: 100,
      });
      return page.items.filter((t) => t.sourceMeetingId === id);
    },
    enabled: Boolean(meeting.data),
  });

  const saveNotes = useCallback(
    async (rawNotes: string) => {
      const saved = await api.meetings.update(id, { rawNotes });
      queryClient.setQueryData(keys.meetings.one(id), saved);
      return saved;
    },
    [id, queryClient],
  );
  const notes = useAutosave(meeting.data?.rawNotes ?? "", saveNotes);

  const invalidateItems = [
    keys.meetings.noteItems(id),
    keys.meetings.status(id),
  ];
  const split = useApiMutation(
    async (replace: boolean) => {
      const existing = items.data ?? [];
      if (existing.length === 0 || replace) {
        return api.meetings.split(id, replace);
      }
      // Add only the lines that are not items yet, so what was already
      // processed keeps its markers.
      const known = new Set(existing.map((i) => i.content.trim()));
      const lines = notes.value
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !known.has(l));
      let position = Math.max(-1, ...existing.map((i) => i.position)) + 1;
      const created: MeetingNoteItem[] = [];
      for (const content of lines) {
        created.push(
          await api.meetings.addNoteItem(id, { content, position: position++ }),
        );
      }
      return created;
    },
    {
      invalidate: invalidateItems,
      successMessage: (created) =>
        created.length
          ? `${created.length} line${created.length === 1 ? "" : "s"} ready to process`
          : "Nothing new to split",
      onSuccess: () => setConfirmRebuild(false),
    },
  );
  const dismiss = useApiMutation(
    (item: MeetingNoteItem) =>
      api.meetings.updateNoteItem(item.id, { processed: !item.processed }),
    { invalidate: invalidateItems },
  );
  const removeItem = useApiMutation(
    (itemId: string) => api.meetings.removeNoteItem(itemId),
    {
      invalidate: invalidateItems,
    },
  );
  const remove = useApiMutation(() => api.meetings.remove(id), {
    invalidate: [keys.meetings.all, keys.organizations.all],
    successMessage: "Meeting deleted",
    onSuccess: () => router.push("/meetings"),
  });

  const counts = useMemo(() => {
    const all = items.data ?? [];
    const processed = all.filter((i) => i.processed).length;
    return {
      captured: all.length,
      processed,
      remaining: all.length - processed,
    };
  }, [items.data]);

  if (meeting.isLoading) return <Spinner />;
  if (meeting.error || !meeting.data)
    return <ErrorState error={meeting.error ?? new Error("Not found")} />;
  const m = meeting.data;
  const org = lookup.organization(m.organizationId);
  const project = lookup.project(m.projectId);
  const scope = { organizationId: m.organizationId, projectId: m.projectId };

  const unsplitLines =
    notes.value.split("\n").filter((l) => l.trim()).length - counts.captured;

  return (
    <>
      <div className="text-fg-muted mb-4 text-sm">
        <Link
          href="/meetings"
          className="hover:text-fg flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Meetings
        </Link>
      </div>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{m.title}</h1>
          <div className="text-fg-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span>{formatDateTime(m.date)}</span>
            {(org || project) && (
              <span>
                {org && (
                  <Link
                    href={`/organizations/${org.id}`}
                    className="hover:underline"
                  >
                    {org.name}
                  </Link>
                )}
                {org && project && " · "}
                {project && (
                  <Link
                    href={`/projects/${project.id}`}
                    className="hover:underline"
                  >
                    {project.name}
                  </Link>
                )}
              </span>
            )}
            {m.attendees && (
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {m.attendees}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete"
          >
            <Trash2 className="text-danger h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          <Card className="p-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium">Raw notes</h2>
              <span className="text-fg-faint text-xs">
                {notes.status === "error"
                  ? "Not saved"
                  : notes.status === "saving"
                    ? "Saving…"
                    : "Saved"}
              </span>
            </div>
            <textarea
              value={notes.value}
              onChange={(e) => notes.onChange(e.target.value)}
              placeholder={
                "One thought per line, as it happens.\nDon't tidy — that comes after."
              }
              className="border-border bg-bg placeholder:text-fg-faint focus:border-accent min-h-56 w-full resize-y rounded-lg border p-3 font-mono text-[13px] leading-relaxed outline-none"
              spellCheck={false}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-fg-faint text-xs">
                Processing never edits this text.
              </p>
              <div className="flex gap-2">
                {counts.captured > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmRebuild(true)}
                  >
                    Rebuild items
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => split.mutate(false)}
                  loading={split.isPending}
                  disabled={!notes.value.trim() || notes.dirty}
                  title={notes.dirty ? "Wait for the notes to save" : undefined}
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  {counts.captured === 0
                    ? "Split into items"
                    : unsplitLines > 0
                      ? `Split ${unsplitLines} new line${unsplitLines === 1 ? "" : "s"}`
                      : "Split new lines"}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-medium">
                <ListChecks className="text-fg-faint h-4 w-4" />
                Items
                {counts.captured > 0 && (
                  <span className="text-fg-muted font-normal">
                    {counts.processed}/{counts.captured} processed
                    {counts.remaining > 0 && (
                      <Badge tone="warn" className="ml-2">
                        {counts.remaining} to go
                      </Badge>
                    )}
                  </span>
                )}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setProcessing("new")}
              >
                <Plus className="h-3.5 w-3.5" />
                Create from meeting
              </Button>
            </div>
            {counts.captured > 0 && (
              <div className="bg-surface-2 mb-3 h-1 overflow-hidden rounded-full">
                <div
                  className="bg-ok h-full transition-all"
                  style={{
                    width: `${(counts.processed / counts.captured) * 100}%`,
                  }}
                />
              </div>
            )}
            {items.isLoading ? (
              <Spinner className="py-6" />
            ) : (items.data?.length ?? 0) === 0 ? (
              <p className="border-border text-fg-faint rounded-lg border border-dashed px-3 py-6 text-center text-sm">
                Split the raw notes and each line shows up here to be turned
                into something.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {items.data!.map((item) => (
                  <NoteItemRow
                    key={item.id}
                    item={item}
                    onProcess={() => setProcessing(item)}
                    onDismiss={() => dismiss.mutate(item)}
                    onRemove={() => removeItem.mutate(item.id)}
                  />
                ))}
              </ul>
            )}
          </Card>

          {tasks.data && tasks.data.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-2 text-sm font-medium">
                Tasks from this meeting
              </h2>
              <TaskList tasks={tasks.data} showStatus />
            </Card>
          )}

          <Card className="p-5">
            <NotesPanel
              query={{ meetingId: id }}
              defaults={{ meetingId: id, ...scope }}
            />
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="p-4">
            <AttachmentList
              scope={{ meetingId: id, ...scope }}
              query={{ meetingId: id }}
              emptyHint="Paste a screenshot anywhere on this page — it lands here."
            />
          </Card>
          <Card className="text-fg-muted p-4 text-xs">
            <p className="text-fg mb-1 flex items-center gap-1.5 font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              During the call
            </p>
            <p>
              Keep typing in the raw notes. Screenshot with <kbd>⌘⇧⌃4</kbd> and{" "}
              <kbd>⌘V</kbd> — no need to click first. Process the lines
              afterwards.
            </p>
          </Card>
        </aside>
      </div>

      <MeetingDialog
        open={editing}
        onClose={() => setEditing(false)}
        meeting={m}
      />
      <ProcessDialog
        open={processing !== null}
        onClose={() => setProcessing(null)}
        meeting={m}
        item={processing && processing !== "new" ? processing : undefined}
      />
      <ConfirmDialog
        open={confirmRebuild}
        onClose={() => setConfirmRebuild(false)}
        onConfirm={() => split.mutate(true)}
        loading={split.isPending}
        destructive
        title="Rebuild items from the raw notes?"
        description="Every existing item is discarded, including which ones were processed. The things they became (tasks, requirements…) are kept."
        confirmLabel="Rebuild"
      />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        destructive
        title={`Delete ${m.title}?`}
        description="The raw notes and note items go. Tasks, requirements and decisions created from it are kept."
        confirmLabel="Delete"
      />
    </>
  );
}

function NoteItemRow({
  item,
  onProcess,
  onDismiss,
  onRemove,
}: {
  item: MeetingNoteItem;
  onProcess: () => void;
  onDismiss: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="group flex items-start gap-3 py-2">
      <button
        onClick={onDismiss}
        className={cn(
          "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors",
          item.processed
            ? "border-ok bg-ok text-white"
            : "border-border-strong hover:border-accent",
        )}
        aria-label={
          item.processed
            ? "Mark unprocessed"
            : "Dismiss without creating anything"
        }
        title={
          item.processed ? "Mark unprocessed" : "Dismiss — nothing to create"
        }
      >
        {item.processed && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm", item.processed && "text-fg-faint")}>
          {item.content}
        </p>
        {item.resultKind && (
          <ResultLink kind={item.resultKind} id={item.resultId} />
        )}
      </div>
      {!item.processed && (
        <Button variant="secondary" size="sm" onClick={onProcess}>
          Process
        </Button>
      )}
      <button
        onClick={onRemove}
        className="text-fg-faint hover:text-danger p-1 opacity-0 group-hover:opacity-100"
        aria-label="Remove line"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function ResultLink({
  kind,
  id,
}: {
  kind: ProcessedItemKind;
  id: string | null;
}) {
  const href = !id
    ? null
    : createsTask(kind)
      ? `/tasks/${id}`
      : createsRequirement(kind)
        ? `/requirements`
        : kind === "decision"
          ? `/decisions`
          : `/notes/${id}`;
  const label = `→ ${processedKindLabel[kind]}`;
  return href ? (
    <Link href={href} className="text-accent text-xs hover:underline">
      {label}
    </Link>
  ) : (
    <span className="text-fg-faint text-xs">{label}</span>
  );
}

export type { Meeting };
