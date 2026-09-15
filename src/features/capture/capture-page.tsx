"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckSquare,
  ClipboardPaste,
  ImageIcon,
  NotebookPen,
  Plus,
  StickyNote,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/api";
import { errorMessage } from "@/lib/api";
import type { Attachment, Meeting, UUID } from "@/lib/api";
import { keys } from "@/lib/query";
import { useLookup } from "@/lib/hooks";
import { uploadAttachment } from "@/lib/upload";
import { addDays, formatDateTime, formatTime, pluralize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/field";
import { Badge, Card, PageHeader } from "@/components/ui/misc";
import { ScopePicker } from "@/components/layout/scope-picker";
import { DropZone } from "@/features/attachments/drop-zone";
import { AttachmentTile } from "@/features/attachments/attachment-list";
import { MeetingDialog } from "@/features/meetings/meeting-dialog";
import { cn } from "@/lib/utils";

type Kind = "task" | "note" | "activity" | "meeting";

interface Captured {
  id: string;
  kind: Kind | "screenshot";
  title: string;
  href?: string;
  at: string;
}

const KINDS: {
  value: Kind;
  label: string;
  icon: typeof CheckSquare;
  hint: string;
}[] = [
  {
    value: "task",
    label: "Tasks",
    icon: CheckSquare,
    hint: "One per line. Lands in the Inbox unless filed.",
  },
  {
    value: "note",
    label: "Note",
    icon: StickyNote,
    hint: "First line is the title, the rest is the body.",
  },
  {
    value: "activity",
    label: "Did it",
    icon: NotebookPen,
    hint: "Something you already finished. One per line.",
  },
  {
    value: "meeting",
    label: "Meeting notes",
    icon: Users,
    hint: "Appended to the meeting's raw notes, untouched.",
  },
];

/**
 * Capture first, organize later.
 *
 * The page is a text box and a paste target. Text becomes tasks, a note, an
 * activity entry or raw meeting lines depending on the kind; a screenshot
 * pasted anywhere on the page becomes an attachment filed under the same
 * scope. Pick a meeting and everything captured is pinned to it — this is
 * the "screenshot during a call" path the product plan calls PC-first.
 */
export function CapturePage() {
  const queryClient = useQueryClient();
  const lookup = useLookup();

  const [kind, setKind] = useState<Kind>("task");
  const [text, setText] = useState("");
  const [scope, setScope] = useState<{
    organizationId: UUID | null;
    projectId: UUID | null;
  }>({
    organizationId: null,
    projectId: null,
  });
  const [meetingId, setMeetingId] = useState<UUID | null>(null);
  const [newMeeting, setNewMeeting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [captured, setCaptured] = useState<Captured[]>([]);
  const [screenshots, setScreenshots] = useState<Attachment[]>([]);
  const textarea = useRef<HTMLTextAreaElement>(null);

  // Recent meetings for the picker: last 7 days plus anything scheduled ahead.
  const recentMeetings = useQuery({
    queryKey: keys.meetings.list({ recent: true }),
    queryFn: () =>
      api.meetings.list({
        from: addDays(new Date(), -7).toISOString(),
        pageSize: 50,
      }),
    select: (page) => page.items,
  });
  const meeting = useMemo(
    () => recentMeetings.data?.find((m) => m.id === meetingId) ?? null,
    [recentMeetings.data, meetingId],
  );

  // Selecting a meeting adopts its scope and switches to meeting-notes mode.
  const chooseMeeting = (m: Meeting | null) => {
    setMeetingId(m?.id ?? null);
    if (m) {
      setScope({ organizationId: m.organizationId, projectId: m.projectId });
      setKind("meeting");
    } else if (kind === "meeting") {
      setKind("task");
    }
  };

  useEffect(() => {
    textarea.current?.focus();
  }, [kind]);

  const record = (entry: Omit<Captured, "at">) =>
    setCaptured((c) =>
      [{ ...entry, at: new Date().toISOString() }, ...c].slice(0, 30),
    );

  const submit = async () => {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    setSaving(true);
    try {
      if (kind === "task") {
        const filed = Boolean(scope.organizationId || scope.projectId);
        for (const line of lines) {
          const task = await api.tasks.create({
            title: line,
            ...scope,
            status: filed ? "next" : "inbox",
            sourceMeetingId: meetingId ?? undefined,
          });
          record({
            id: task.id,
            kind,
            title: task.title,
            href: `/tasks/${task.id}`,
          });
        }
        void queryClient.invalidateQueries({ queryKey: keys.tasks.all });
        toast.success(
          filed
            ? `${pluralize(lines.length, "task")} filed`
            : `${pluralize(lines.length, "task")} in the Inbox`,
        );
      } else if (kind === "note") {
        const [first, ...rest] = lines;
        const body = rest.length ? rest.join("\n") : first;
        const note = await api.notes.create({
          title: rest.length ? first : first.length > 60 ? null : first,
          body,
          ...scope,
          meetingId: meetingId ?? undefined,
        });
        record({ id: note.id, kind, title: first, href: `/notes/${note.id}` });
        void queryClient.invalidateQueries({ queryKey: keys.notes.all });
        toast.success("Note saved");
      } else if (kind === "activity") {
        for (const line of lines) {
          const entry = await api.activity.create({
            description: line,
            source: "manual",
            ...scope,
            meetingId: meetingId ?? undefined,
          });
          record({
            id: entry.id,
            kind,
            title: entry.description,
            href: "/activity",
          });
        }
        void queryClient.invalidateQueries({ queryKey: keys.activity.all });
        toast.success(`${pluralize(lines.length, "entry", "entries")} logged`);
      } else if (kind === "meeting" && meeting) {
        const existing = meeting.rawNotes.trimEnd();
        const rawNotes = existing
          ? `${existing}\n${lines.join("\n")}`
          : lines.join("\n");
        await api.meetings.update(meeting.id, { rawNotes });
        record({
          id: `${meeting.id}-${Date.now()}`,
          kind,
          title:
            lines.length === 1
              ? lines[0]
              : `${lines.length} lines → ${meeting.title}`,
          href: `/meetings/${meeting.id}`,
        });
        void queryClient.invalidateQueries({ queryKey: keys.meetings.all });
        toast.success(`Added to ${meeting.title}`);
      }
      setText("");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
      textarea.current?.focus();
    }
  };

  const onFiles = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        setUploading((n) => n + 1);
        try {
          const attachment = await uploadAttachment(file, {
            ...scope,
            meetingId: meetingId ?? undefined,
          });
          setScreenshots((s) => [attachment, ...s]);
          record({
            id: attachment.id,
            kind: "screenshot",
            title: attachment.fileName,
            href: meetingId ? `/meetings/${meetingId}` : undefined,
          });
          void queryClient.invalidateQueries({
            queryKey: keys.attachments.all,
          });
          toast.success(
            meeting
              ? `Screenshot pinned to ${meeting.title}`
              : "Screenshot saved",
          );
        } catch (error) {
          toast.error(errorMessage(error));
        } finally {
          setUploading((n) => n - 1);
        }
      }
    },
    [scope, meetingId, meeting, queryClient],
  );

  const active = KINDS.find((k) => k.value === kind)!;
  const disabledMeetingKind = kind === "meeting" && !meeting;

  return (
    <DropZone onFiles={onFiles} className="min-h-[70vh]">
      <PageHeader
        title="Capture"
        subtitle="Type it or paste it. Sort it out later."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="bg-surface-2 flex flex-wrap gap-1 rounded-lg p-1">
                {KINDS.map((k) => (
                  <button
                    key={k.value}
                    onClick={() => setKind(k.value)}
                    disabled={k.value === "meeting" && !meeting}
                    className={cn(
                      "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors disabled:opacity-40",
                      kind === k.value
                        ? "bg-surface text-fg shadow-sm"
                        : "text-fg-muted hover:text-fg",
                    )}
                  >
                    <k.icon className="h-3.5 w-3.5" />
                    {k.label}
                  </button>
                ))}
              </div>
              <span className="text-fg-faint text-xs">{active.hint}</span>
            </div>

            <Textarea
              ref={textarea}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder={placeholderFor(kind, meeting)}
              className="min-h-32 text-[15px]"
              disabled={saving || disabledMeetingKind}
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-fg-faint text-xs">
                <kbd>⌘</kbd> + <kbd>↵</kbd> to save · paste an image anywhere
              </span>
              <Button
                onClick={() => void submit()}
                loading={saving}
                disabled={!text.trim() || disabledMeetingKind}
              >
                <Plus className="h-4 w-4" />
                {kind === "task"
                  ? "Add tasks"
                  : kind === "meeting"
                    ? "Add to meeting"
                    : "Save"}
              </Button>
            </div>
          </Card>

          {(screenshots.length > 0 || uploading > 0) && (
            <Card className="p-4">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <ImageIcon className="text-fg-faint h-4 w-4" />
                Pasted this session
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {Array.from({ length: uploading }).map((_, i) => (
                  <div
                    key={`up-${i}`}
                    className="border-border bg-surface-2 text-fg-muted flex aspect-[4/3] animate-pulse items-center justify-center rounded-lg border text-xs"
                  >
                    Uploading…
                  </div>
                ))}
                {screenshots.map((a) => (
                  <AttachmentTile
                    key={a.id}
                    attachment={a}
                    onDeleted={() =>
                      setScreenshots((s) => s.filter((x) => x.id !== a.id))
                    }
                  />
                ))}
              </div>
            </Card>
          )}

          {captured.length > 0 && (
            <Card className="p-4">
              <h3 className="mb-2 text-sm font-medium">Captured just now</h3>
              <ul className="divide-border divide-y text-sm">
                {captured.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 py-1.5">
                    <Badge tone={c.kind === "screenshot" ? "violet" : "accent"}>
                      {kindLabel[c.kind]}
                    </Badge>
                    {c.href ? (
                      <Link
                        href={c.href}
                        className="min-w-0 flex-1 truncate hover:underline"
                      >
                        {c.title}
                      </Link>
                    ) : (
                      <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    )}
                    <span className="text-fg-faint text-xs">
                      {formatTime(c.at)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="p-4">
            <h3 className="text-fg-muted mb-2 text-[12px] font-medium tracking-wide uppercase">
              File under
            </h3>
            <ScopePicker
              organizationId={scope.organizationId}
              projectId={scope.projectId}
              onChange={setScope}
              className="grid-cols-1 sm:grid-cols-1"
            />
            <p className="text-fg-faint mt-2 text-xs">
              {scope.organizationId || scope.projectId
                ? "Tasks go straight to Next."
                : "Nothing chosen — tasks go to the Inbox."}
            </p>
          </Card>

          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-fg-muted text-[12px] font-medium tracking-wide uppercase">
                In a meeting?
              </h3>
              <button
                onClick={() => setNewMeeting(true)}
                className="text-accent text-xs font-medium hover:underline"
              >
                + New
              </button>
            </div>
            <Select
              value={meetingId ?? ""}
              onChange={(e) =>
                chooseMeeting(
                  recentMeetings.data?.find((m) => m.id === e.target.value) ??
                    null,
                )
              }
            >
              <option value="">Not in a meeting</option>
              {recentMeetings.data?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} · {formatDateTime(m.date)}
                </option>
              ))}
            </Select>
            {meeting ? (
              <p className="text-fg-faint mt-2 text-xs">
                Screenshots and notes are pinned to{" "}
                <Link
                  href={`/meetings/${meeting.id}`}
                  className="text-accent hover:underline"
                >
                  {meeting.title}
                </Link>
                .
              </p>
            ) : (
              <p className="text-fg-faint mt-2 text-xs">
                Pick one and pasted screenshots land on it, with raw notes you
                can process later.
              </p>
            )}
          </Card>

          <Card className="text-fg-muted p-4 text-xs">
            <p className="text-fg mb-1.5 flex items-center gap-1.5 font-medium">
              <ClipboardPaste className="h-3.5 w-3.5" />
              Screenshot to Planner in two keys
            </p>
            <p>
              <kbd>⌘</kbd>+<kbd>⇧</kbd>+<kbd>⌃</kbd>+<kbd>4</kbd> on a Mac (or{" "}
              <kbd>Win</kbd>+<kbd>⇧</kbd>+<kbd>S</kbd>) copies a region to the
              clipboard. Then <kbd>⌘</kbd>+<kbd>V</kbd> here — no click needed.
            </p>
            {!lookup.loading && lookup.organizations.length === 0 && (
              <p className="border-border mt-2 border-t pt-2">
                No organizations yet.{" "}
                <Link
                  href="/organizations"
                  className="text-accent hover:underline"
                >
                  Create one
                </Link>{" "}
                to file things under.
              </p>
            )}
          </Card>
        </aside>
      </div>

      <MeetingDialog
        open={newMeeting}
        onClose={() => setNewMeeting(false)}
        defaultScope={scope}
        onSaved={(m) => {
          void queryClient.invalidateQueries({ queryKey: keys.meetings.all });
          // The list refetches asynchronously; select it once it is there.
          void queryClient
            .fetchQuery({
              queryKey: keys.meetings.list({ recent: true }),
              queryFn: () =>
                api.meetings.list({
                  from: addDays(new Date(), -7).toISOString(),
                  pageSize: 50,
                }),
            })
            .then(() => chooseMeeting(m));
        }}
      />
    </DropZone>
  );
}

const kindLabel: Record<Captured["kind"], string> = {
  task: "Task",
  note: "Note",
  activity: "Did",
  meeting: "Meeting",
  screenshot: "Screenshot",
};

function placeholderFor(kind: Kind, meeting: Meeting | null): string {
  switch (kind) {
    case "task":
      return "Call the supplier about the invoice\nDraft the Q3 roadmap\nAsk Sara for the API keys";
    case "note":
      return "Title on the first line\nThen the note itself…";
    case "activity":
      return "Reviewed the vendor contract\nFixed the deploy script";
    case "meeting":
      return meeting
        ? `Raw notes for ${meeting.title} — one thought per line`
        : "Pick a meeting on the right first";
  }
}
