"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import * as api from "@/lib/api";
import type { UUID } from "@/lib/api";
import { keys } from "@/lib/query";
import { useApiMutation } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/misc";
import { ScopePicker } from "@/components/layout/scope-picker";

/**
 * A draft that becomes a note on first save. The API refuses an empty body,
 * so the row is created here rather than by the list page, and the editor
 * (which autosaves) takes over once it exists.
 */
export function NewNotePage() {
  const router = useRouter();
  const params = useSearchParams();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scope, setScope] = useState<{
    organizationId: UUID | null;
    projectId: UUID | null;
  }>({
    organizationId: params.get("organizationId"),
    projectId: params.get("projectId"),
  });

  const create = useApiMutation(
    (input: api.NoteInput) => api.notes.create(input),
    {
      invalidate: [keys.notes.all],
      onSuccess: (note) => router.replace(`/notes/${note.id}`),
    },
  );

  const save = () => {
    if (!body.trim() && !title.trim()) return;
    create.mutate({
      title: title.trim() || null,
      body: body.trim() || title.trim(),
      ...scope,
    });
  };

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
        <Button
          size="sm"
          onClick={save}
          loading={create.isPending}
          disabled={!body.trim() && !title.trim()}
        >
          Save note
        </Button>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
        <Card className="p-5">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
            className="placeholder:text-fg-faint w-full bg-transparent text-xl font-semibold tracking-tight outline-none"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
            }}
            placeholder="Start writing… ⌘↵ to save"
            className="placeholder:text-fg-faint mt-3 min-h-[50vh] w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none"
          />
        </Card>
        <aside>
          <Card className="p-4">
            <h3 className="text-fg-muted mb-2 text-[12px] font-medium tracking-wide uppercase">
              Filed under
            </h3>
            <ScopePicker
              organizationId={scope.organizationId}
              projectId={scope.projectId}
              onChange={setScope}
              className="grid-cols-1 sm:grid-cols-1"
            />
          </Card>
        </aside>
      </div>
    </>
  );
}
