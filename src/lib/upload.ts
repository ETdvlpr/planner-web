import * as api from "@/lib/api";
import type { Attachment, AttachmentKind, UUID } from "@/lib/api";

export interface UploadScope {
  organizationId?: UUID | null;
  projectId?: UUID | null;
  taskId?: UUID;
  meetingId?: UUID;
  noteId?: UUID;
  requirementId?: UUID;
}

/**
 * The three-step upload the API is designed around: create the row and get a
 * presigned URL, PUT the bytes straight to R2, confirm. The API never sees
 * the bytes — that is what keeps a 20 MB screenshot off its 1 vCPU.
 *
 * `Content-Length` is deliberately not forwarded: browsers set it themselves
 * and refuse a script-supplied value. The size is still what was signed, so
 * a mismatched body is rejected by R2.
 */
export async function uploadAttachment(
  file: File,
  scope: UploadScope,
  { kind, caption }: { kind?: AttachmentKind; caption?: string } = {},
): Promise<Attachment> {
  const { attachment, upload } = await api.attachments.create({
    kind: kind ?? kindFor(file),
    fileName: file.name || defaultName(file),
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    caption,
    ...scope,
  });

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(upload.headers)) {
    if (key.toLowerCase() !== "content-length") headers[key] = value;
  }

  const response = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers,
    body: file,
  });
  if (!response.ok) {
    throw new Error(
      `Upload to storage failed (${response.status}). ` +
        "If this persists, check the bucket's CORS rules allow PUT from this origin.",
    );
  }

  return api.attachments.confirm(attachment.id, upload.objectKey);
}

/** A pasted screenshot has no name and a generic type; give it both. */
export function kindFor(file: File): AttachmentKind {
  if (!file.type.startsWith("image/")) return "file";
  return file.name && !/^image\.(png|jpe?g)$/i.test(file.name)
    ? "image"
    : "screenshot";
}

export function defaultName(file: File): string {
  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "bin";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `screenshot-${stamp}.${ext}`;
}

/** Files from a paste event — screenshots arrive as `image/png` items. */
export function filesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files: File[] = [];
  for (const item of Array.from(data.items)) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file) files.push(file);
  }
  return files;
}

export function filesFromDrop(data: DataTransfer | null): File[] {
  return data ? Array.from(data.files) : [];
}
