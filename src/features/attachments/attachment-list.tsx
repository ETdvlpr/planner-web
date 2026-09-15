"use client";

import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileIcon, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/api";
import { errorMessage } from "@/lib/api";
import type { Attachment } from "@/lib/api";
import { keys } from "@/lib/query";
import { useApiMutation } from "@/lib/hooks";
import { uploadAttachment, type UploadScope } from "@/lib/upload";
import { formatBytes, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DropZone } from "./drop-zone";
import { cn } from "@/lib/utils";

/**
 * The attachments of one owner (task, meeting, note, requirement, project),
 * with paste/drop/pick upload into the same owner.
 */
export function AttachmentList({
  scope,
  query,
  listenForPaste = true,
  emptyHint = "Paste a screenshot, drop a file or pick one.",
}: {
  scope: UploadScope;
  query: api.AttachmentQuery;
  listenForPaste?: boolean;
  emptyHint?: string;
}) {
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: keys.attachments.list(query),
    queryFn: () => api.attachments.list({ ...query, pageSize: 100 }),
  });
  const [uploading, setUploading] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const onFiles = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        const label = file.name || "screenshot";
        setUploading((u) => [...u, label]);
        try {
          await uploadAttachment(file, scope);
          void queryClient.invalidateQueries({
            queryKey: keys.attachments.all,
          });
        } catch (error) {
          toast.error(`${label}: ${errorMessage(error)}`);
        } finally {
          setUploading((u) => {
            const i = u.indexOf(label);
            return i < 0 ? u : [...u.slice(0, i), ...u.slice(i + 1)];
          });
        }
      }
    },
    [scope, queryClient],
  );

  const items = list.data?.items ?? [];

  return (
    <DropZone onFiles={onFiles} listenForPaste={listenForPaste}>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Paperclip className="text-fg-faint h-4 w-4" />
          Attachments
          {items.length > 0 && (
            <span className="text-fg-faint">{items.length}</span>
          )}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fileInput.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          Add
        </Button>
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) void onFiles(files);
          }}
        />
      </div>

      {items.length === 0 && uploading.length === 0 ? (
        <p className="border-border text-fg-faint mt-2 rounded-lg border border-dashed px-3 py-4 text-center text-xs">
          {emptyHint}
        </p>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {items.map((a) => (
            <AttachmentTile key={a.id} attachment={a} />
          ))}
          {uploading.map((label, i) => (
            <div
              key={`${label}-${i}`}
              className="border-border bg-surface-2 text-fg-muted flex aspect-[4/3] animate-pulse items-center justify-center rounded-lg border px-2 text-center text-xs"
            >
              Uploading {label}…
            </div>
          ))}
        </div>
      )}
    </DropZone>
  );
}

export function AttachmentTile({
  attachment,
  onDeleted,
}: {
  attachment: Attachment;
  onDeleted?: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const isImage = attachment.mimeType?.startsWith("image/") ?? false;
  const uploaded = Boolean(attachment.objectKey);

  const url = useQuery({
    queryKey: keys.attachments.url(attachment.id),
    queryFn: () => api.attachments.url(attachment.id),
    enabled: uploaded,
    // Presigned URLs live an hour; refetch before that, not on every focus.
    staleTime: 45 * 60_000,
    refetchOnWindowFocus: false,
  });

  const remove = useApiMutation(() => api.attachments.remove(attachment.id), {
    invalidate: [keys.attachments.all],
    onSuccess: () => {
      setConfirm(false);
      onDeleted?.();
    },
  });

  const caption = attachment.caption || attachment.fileName;

  return (
    <div className="group border-border bg-surface-2 relative overflow-hidden rounded-lg border">
      <a
        href={url.data?.url ?? undefined}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "flex aspect-[4/3] items-center justify-center overflow-hidden",
          !url.data && "pointer-events-none",
        )}
        title={caption}
      >
        {isImage && url.data ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url.data.url}
            alt={caption}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="text-fg-faint flex flex-col items-center gap-1 px-2 text-center">
            <FileIcon className="h-6 w-6" />
            <span className="line-clamp-2 text-[11px]">
              {attachment.fileName}
            </span>
            {!uploaded && <span className="text-[10px]">not uploaded</span>}
          </div>
        )}
      </a>
      <div className="text-fg-muted flex items-center gap-1 px-2 py-1 text-[11px]">
        <span
          className="min-w-0 flex-1 truncate"
          title={formatDateTime(attachment.createdAt)}
        >
          {caption}
        </span>
        <span className="text-fg-faint shrink-0">
          {formatBytes(attachment.sizeBytes)}
        </span>
      </div>
      <button
        onClick={() => setConfirm(true)}
        className="bg-surface/90 text-fg-muted hover:text-danger absolute top-1 right-1 rounded-md p-1 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
        aria-label="Delete attachment"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        destructive
        title="Delete attachment?"
        description={`${caption} will be removed. The file stays in storage for a while and can be recovered from the mobile app's trash.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
