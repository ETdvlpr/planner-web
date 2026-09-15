import type {
  ActivitySource,
  DeadlinePrecision,
  OrgStatus,
  ProcessedItemKind,
  ProjectStatus,
  RecurrenceSpec,
  RequirementStatus,
  RequirementType,
  TaskContextTag,
  TaskPriority,
  TaskStatus,
  TaskType,
} from "@/lib/api/types";

/**
 * Labels and date helpers. Enum labels live here rather than beside each
 * component so a status reads the same in a list, a badge and a select.
 */

export const taskStatusLabel: Record<TaskStatus, string> = {
  inbox: "Inbox",
  next: "Next",
  inProgress: "In progress",
  waiting: "Waiting",
  done: "Done",
  dropped: "Dropped",
  someday: "Someday",
};

export const taskTypeLabel: Record<TaskType, string> = {
  projectWork: "Project work",
  admin: "Admin",
  followUp: "Follow-up",
  investigation: "Investigation",
  personal: "Personal",
};

export const taskPriorityLabel: Record<TaskPriority, string> = {
  p1: "P1 — urgent",
  p2: "P2 — normal",
  p3: "P3 — low",
};

export const taskContextLabel: Record<TaskContextTag, string> = {
  quick: "Quick",
  deepWork: "Deep work",
  call: "Call",
  review: "Review",
  computer: "Computer",
  errand: "Errand",
  meeting: "Meeting",
};

export const orgStatusLabel: Record<OrgStatus, string> = {
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};

export const projectStatusLabel: Record<ProjectStatus, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  archived: "Archived",
};

export const requirementTypeLabel: Record<RequirementType, string> = {
  feature: "Feature",
  requirement: "Requirement",
  idea: "Idea",
  investigation: "Investigation",
  question: "Question",
};

export const requirementStatusLabel: Record<RequirementStatus, string> = {
  unreviewed: "Unreviewed",
  accepted: "Accepted",
  planned: "Planned",
  rejected: "Rejected",
  implemented: "Implemented",
};

export const activitySourceLabel: Record<ActivitySource, string> = {
  taskCompletion: "Task completed",
  manual: "Logged",
  recurringTask: "Recurring task",
  meeting: "Meeting",
  note: "Note",
};

export const processedKindLabel: Record<ProcessedItemKind, string> = {
  task: "Task",
  followUp: "Follow-up",
  requirement: "Requirement",
  feature: "Feature",
  idea: "Idea",
  investigation: "Investigation",
  question: "Question",
  decision: "Decision",
  note: "Note",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "Every 2 weeks", "Weekly on Mon, Wed", "Monthly on the 15th". */
export function recurrenceLabel(spec: RecurrenceSpec): string {
  const n = Math.max(1, spec.interval ?? 1);
  switch (spec.frequency) {
    case "daily":
      return n === 1 ? "Daily" : `Every ${n} days`;
    case "weekly":
      return n === 1 ? "Weekly" : `Every ${n} weeks`;
    case "monthly":
      return (
        (n === 1 ? "Monthly" : `Every ${n} months`) +
        (spec.dayOfMonth ? ` on the ${ordinal(spec.dayOfMonth)}` : "")
      );
    case "yearly":
      return n === 1 ? "Yearly" : `Every ${n} years`;
    case "everyNWeeks":
      return `Every ${n} weeks`;
    case "everyNMonths":
      return `Every ${n} months`;
    case "selectedWeekdays": {
      const mask = spec.weekdaysMask ?? 0;
      const days = WEEKDAYS.filter((_, i) => mask & (1 << i));
      return days.length ? `Weekly on ${days.join(", ")}` : "Weekly";
    }
  }
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

// ────────────────────────────────────────────────────────────────────── dates

const dateFmt = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
});
const dateYearFmt = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

export function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/** "Today", "Tomorrow", "Yesterday", "12 Mar" or "12 Mar 2025". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const today = startOfDay(new Date());
  const diff = Math.round((startOfDay(d).getTime() - today.getTime()) / 864e5);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return d.getFullYear() === today.getFullYear()
    ? dateFmt.format(d)
    : dateYearFmt.format(d);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return dateTimeFmt.format(new Date(iso));
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return timeFmt.format(new Date(iso));
}

/** Relative age for lists — "just now", "5m", "3h", "2d", else the date. */
export function formatAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60e3);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  return formatDate(iso);
}

/** Monday-based start of the week, at local midnight. */
export function startOfWeek(d: Date): Date {
  const out = startOfDay(d);
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  return out;
}

/** Sunday of the week containing `d`, at local midnight. */
export function endOfWeek(d: Date): Date {
  return addDays(startOfWeek(d), 6);
}

/** "This week", "Next week", "Last week", or "Week of 21 Sep". */
export function formatWeek(iso: string | null | undefined): string {
  if (!iso) return "";
  const week = startOfWeek(new Date(iso));
  const weeks = Math.round(
    (week.getTime() - startOfWeek(new Date()).getTime()) / (7 * 864e5),
  );
  if (weeks === 0) return "This week";
  if (weeks === 1) return "Next week";
  if (weeks === -1) return "Last week";
  return `Week of ${formatDate(week.toISOString())}`;
}

/** How a deadline reads given how firm it is. */
export function formatDeadline(
  deadline: string | null | undefined,
  precision: DeadlinePrecision = "day",
): string {
  return precision === "week" ? formatWeek(deadline) : formatDate(deadline);
}

/** A deadline that has passed, for an open task. */
export function isOverdue(deadline: string | null): boolean {
  if (!deadline) return false;
  return startOfDay(new Date(deadline)) < startOfDay(new Date());
}

/** `<input type="date">` wants `YYYY-MM-DD` in local time. */
export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `<input type="datetime-local">` wants `YYYY-MM-DDTHH:MM` in local time. */
export function toDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${toDateInput(iso)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A date-only input, interpreted as local midnight, to ISO for the API. */
export function fromDateInput(value: string): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d).toISOString();
}

export function fromDateTimeInput(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** 32-bit ARGB (as Flutter stores it) to a CSS colour. */
export function argbToCss(
  value: number | null | undefined,
): string | undefined {
  if (value == null) return undefined;
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return `rgb(${r} ${g} ${b})`;
}

export function pluralize(n: number, noun: string, plural = `${noun}s`) {
  return `${n} ${n === 1 ? noun : plural}`;
}
