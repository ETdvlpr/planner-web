"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, ArrowLeft, Trash2 } from "lucide-react";
import * as api from "@/lib/api";
import type { UUID } from "@/lib/api";
import { keys } from "@/lib/query";
import { useApiMutation, useAutosave, useLookup } from "@/lib/hooks";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Card, ErrorState, Spinner } from "@/components/ui/misc";
import { ScopePicker } from "@/components/layout/scope-picker";
import { AttachmentList } from "@/features/attachments/attachment-list";

/**
 * A note is a title and a body; both autosave. There is no Save button
 * because a note you have to remember to save is a note you lose.
 */
export function NoteEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const lookup = useLookup();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const note = useQuery({
    queryKey: keys.notes.one(id),
    queryFn: () => api.notes.get(id),
  });

  const patch = useCallback(
    async (input: Partial<api.NoteInput>) => {
      const saved = await api.notes.update(id, input);
      queryClient.setQueryData(keys.notes.one(id), saved);
      void queryClient.invalidateQueries({
        queryKey: keys.notes.list({}),
        exact: false,
      });
      return saved;
    },
    [id, queryClient],
  );
  const saveTitle = useCallback(
    (title: string) => patch({ title: title.trim() || null }),
    [patch],
  );
  const saveBody = useCallback((body: string) => patch({ body }), [patch]);

  const title = useAutosave(note.data?.title ?? "", saveTitle);
  const body = useAutosave(note.data?.body ?? "", saveBody);

  const archive = useApiMutation(
    () =>
      note.data?.archivedAt ? api.notes.unarchive(id) : api.notes.archive(id),
    { invalidate: [keys.notes.all] },
  );
  const remove = useApiMutation(() => api.notes.remove(id), {
    invalidate: [keys.notes.all],
    successMessage: "Note deleted",
    onSuccess: () => router.push("/notes"),
  });
  const rescope = useApiMutation(
    (scope: { organizationId: UUID | null; projectId: UUID | null }) =>
      patch(scope),
    { invalidate: [keys.notes.all] },
  );

  if (note.isLoading) return <Spinner />;
  if (note.error || !note.data)
    return <ErrorState error={note.error ?? new Error("Not found")} />;
  const n = note.data;
  const status =
    body.status === "error" || title.status === "error"
      ? "Not saved"
      : body.status === "saving" || title.status === "saving"
        ? "Saving…"
        : "Saved";

  return (
    <>
      <div className="text-fg-muted mb-4 flex items-center justify-between gap-2 text-sm">
        <button
          onClick={() => router.back()}
          className="hover:text-fg flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <span className="text-xs">{status}</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
        <div className="flex flex-col gap-5">
          <Card className="p-5">
            <input
              value={title.value}
              onChange={(e) => title.onChange(e.target.value)}
              placeholder="Untitled"
              className="placeholder:text-fg-faint w-full bg-transparent text-xl font-semibold tracking-tight outline-none"
            />
            <textarea
              value={body.value}
              onChange={(e) => body.onChange(e.target.value)}
              placeholder="Start writing…"
              className="placeholder:text-fg-faint mt-3 min-h-[50vh] w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none"
              autoFocus={!n.body}
            />
          </Card>
          <Card className="p-5">
            <AttachmentList
              scope={{
                noteId: n.id,
                organizationId: n.organizationId,
                projectId: n.projectId,
              }}
              query={{ noteId: n.id }}
            />
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="p-4">
            <h3 className="text-fg-muted mb-2 text-[12px] font-medium tracking-wide uppercase">
              Filed under
            </h3>
            <ScopePicker
              organizationId={n.organizationId}
              projectId={n.projectId}
              onChange={(s) => rescope.mutate(s)}
              className="grid-cols-1 sm:grid-cols-1"
            />
          </Card>
          <Card className="text-fg-muted p-4 text-xs">
            {n.taskId && (
              <p>
                On task{" "}
                <Link
                  href={`/tasks/${n.taskId}`}
                  className="text-accent hover:underline"
                >
                  open
                </Link>
              </p>
            )}
            {n.meetingId && (
              <p>
                From meeting{" "}
                <Link
                  href={`/meetings/${n.meetingId}`}
                  className="text-accent hover:underline"
                >
                  open
                </Link>
              </p>
            )}
            {n.requirementId && <p>Linked to a requirement</p>}
            <p className="mt-2">Created {formatDateTime(n.createdAt)}</p>
            <p>Updated {formatDateTime(n.updatedAt)}</p>
            {lookup.organization(n.organizationId) && null}
          </Card>
          <Card className="flex flex-col gap-1 p-2">
            <Button
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => archive.mutate()}
            >
              {n.archivedAt ? (
                <>
                  <ArchiveRestore className="h-3.5 w-3.5" /> Unarchive
                </>
              ) : (
                <>
                  <Archive className="h-3.5 w-3.5" /> Archive
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-danger justify-start"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        destructive
        title="Delete note?"
        confirmLabel="Delete"
      />
    </>
  );
}
