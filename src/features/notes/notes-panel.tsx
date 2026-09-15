"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, StickyNote } from "lucide-react";
import * as api from "@/lib/api";
import { keys } from "@/lib/query";
import { useApiMutation } from "@/lib/hooks";
import { formatAgo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";

/**
 * The notes linked to one owner, with an inline "add" box. Used on task,
 * meeting, project and requirement pages; the full editor is a click away.
 */
export function NotesPanel({
  query,
  defaults,
}: {
  query: api.NoteQuery;
  defaults: Omit<api.NoteInput, "body">;
}) {
  const [body, setBody] = useState("");
  const [open, setOpen] = useState(false);
  const notes = useQuery({
    queryKey: keys.notes.list(query),
    queryFn: () => api.notes.list({ ...query, pageSize: 50 }),
  });
  const create = useApiMutation(
    (input: api.NoteInput) => api.notes.create(input),
    {
      invalidate: [keys.notes.all],
      onSuccess: () => {
        setBody("");
        setOpen(false);
      },
    },
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    create.mutate({ ...defaults, body: body.trim() });
  };

  const items = notes.data?.items ?? [];

  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <StickyNote className="text-fg-faint h-4 w-4" />
          Notes{" "}
          {items.length > 0 && (
            <span className="text-fg-faint">{items.length}</span>
          )}
        </h3>
        <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {open && (
        <form onSubmit={submit} className="mt-2 flex flex-col gap-2">
          <Textarea
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write it down…"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(e);
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={create.isPending}
              disabled={!body.trim()}
            >
              Save note
            </Button>
          </div>
        </form>
      )}

      {items.length > 0 && (
        <ul className="divide-border mt-2 divide-y">
          {items.map((n) => (
            <li key={n.id}>
              <Link
                href={`/notes/${n.id}`}
                className="hover:bg-surface-2 block rounded-md px-1 py-2"
              >
                {n.title && <p className="text-sm font-medium">{n.title}</p>}
                <p className="text-fg-muted line-clamp-3 text-sm whitespace-pre-wrap">
                  {n.body}
                </p>
                <p className="text-fg-faint mt-1 text-[11px]">
                  {formatAgo(n.updatedAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
