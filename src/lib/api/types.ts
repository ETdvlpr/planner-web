/**
 * Wire types for planner-api.
 *
 * These mirror `planner-api/prisma/schema.prisma`, with two differences the
 * JSON boundary imposes: every `DateTime` arrives as an ISO-8601 string, and
 * `seq` (a Postgres BigInt) arrives as a decimal string because the API
 * serialises BigInts that way rather than lose precision past 2^53.
 *
 * Enum values are the Dart `Enum.name` strings and are a wire contract shared
 * with the mobile app — renaming one is a data migration, not a refactor.
 */

export type ISODate = string;
export type UUID = string;

// ─────────────────────────────────────────────────────────────────── envelope

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

// ────────────────────────────────────────────────────────────────────── enums

export const ORG_STATUSES = ["active", "paused", "archived"] as const;
export type OrgStatus = (typeof ORG_STATUSES)[number];

export const PROJECT_STATUSES = [
  "active",
  "paused",
  "completed",
  "archived",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const TASK_TYPES = [
  "projectWork",
  "admin",
  "followUp",
  "investigation",
  "personal",
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_STATUSES = [
  "inbox",
  "next",
  "inProgress",
  "waiting",
  "done",
  "dropped",
  "someday",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const OPEN_TASK_STATUSES: readonly TaskStatus[] = [
  "next",
  "inProgress",
  "waiting",
];

export const TASK_PRIORITIES = ["p1", "p2", "p3"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/**
 * How firm a deadline is. A `week` deadline is stored as the last day of its
 * week and means "sometime that week": shown as "This week", and only overdue
 * once the week has ended.
 */
export const DEADLINE_PRECISIONS = ["day", "week"] as const;
export type DeadlinePrecision = (typeof DEADLINE_PRECISIONS)[number];

export const TASK_CONTEXTS = [
  "quick",
  "deepWork",
  "call",
  "review",
  "computer",
  "errand",
  "meeting",
] as const;
export type TaskContextTag = (typeof TASK_CONTEXTS)[number];

export const REQUIREMENT_TYPES = [
  "feature",
  "requirement",
  "idea",
  "investigation",
  "question",
] as const;
export type RequirementType = (typeof REQUIREMENT_TYPES)[number];

export const REQUIREMENT_STATUSES = [
  "unreviewed",
  "accepted",
  "planned",
  "rejected",
  "implemented",
] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const ACTIVITY_SOURCES = [
  "taskCompletion",
  "manual",
  "recurringTask",
  "meeting",
  "note",
] as const;
export type ActivitySource = (typeof ACTIVITY_SOURCES)[number];

export const ATTACHMENT_KINDS = ["screenshot", "image", "file"] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export const RECURRENCE_FREQUENCIES = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "selectedWeekdays",
  "everyNWeeks",
  "everyNMonths",
] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export const PROCESSED_ITEM_KINDS = [
  "task",
  "requirement",
  "feature",
  "idea",
  "investigation",
  "followUp",
  "decision",
  "question",
  "note",
] as const;
export type ProcessedItemKind = (typeof PROCESSED_ITEM_KINDS)[number];

// ───────────────────────────────────────────────────────────────────── models

/** Columns every syncable row carries. */
interface SyncedRow {
  id: UUID;
  userId: UUID;
  createdAt: ISODate;
  updatedAt: ISODate;
  deletedAt: ISODate | null;
  seq: string;
}

export interface User {
  id: UUID;
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
  lastSeenAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
  deletedAt: ISODate | null;
}

export interface Organization extends SyncedRow {
  name: string;
  description: string | null;
  status: OrgStatus;
  favorite: boolean;
  iconCodePoint: number | null;
  colorValue: number | null;
  sortOrder: number;
  archivedAt: ISODate | null;
}

export interface OrganizationSummary {
  organization: Organization;
  counts: {
    projects: number;
    openTasks: number;
    meetings: number;
    openRequirements: number;
  };
}

export interface Project extends SyncedRow {
  organizationId: UUID | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  favorite: boolean;
  iconCodePoint: number | null;
  colorValue: number | null;
  sortOrder: number;
  archivedAt: ISODate | null;
}

export interface RecurrenceRule extends SyncedRow {
  frequency: RecurrenceFrequency;
  interval: number;
  weekdaysMask: number | null;
  dayOfMonth: number | null;
  monthOfYear: number | null;
  reminderDaysBefore: number | null;
  reminderMinuteOfDay: number | null;
  endDate: ISODate | null;
}

export interface RecurrenceSpec {
  frequency: RecurrenceFrequency;
  interval?: number;
  weekdaysMask?: number;
  dayOfMonth?: number;
  monthOfYear?: number;
  reminderDaysBefore?: number;
  reminderMinuteOfDay?: number;
  endDate?: ISODate;
}

export interface Task extends SyncedRow {
  organizationId: UUID | null;
  projectId: UUID | null;
  sourceMeetingId: UUID | null;
  sourceRequirementId: UUID | null;
  parentTaskId: UUID | null;
  recurrenceRuleId: UUID | null;
  recurringSeriesId: UUID | null;
  title: string;
  description: string | null;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  context: TaskContextTag | null;
  waitingOn: string | null;
  deadline: ISODate | null;
  deadlinePrecision: DeadlinePrecision;
  reminderAt: ISODate | null;
  followUpDate: ISODate | null;
  completedAt: ISODate | null;
  droppedAt: ISODate | null;
  carriedForwardAt: ISODate | null;
  carryForwardCount: number;
  sortOrder: number;
}

export interface ChecklistItem extends SyncedRow {
  taskId: UUID;
  label: string;
  done: boolean;
  position: number;
}

export interface Meeting extends SyncedRow {
  organizationId: UUID | null;
  projectId: UUID | null;
  title: string;
  date: ISODate;
  attendees: string | null;
  rawNotes: string;
}

export interface MeetingProcessingStatus {
  captured: number;
  processed: number;
  remaining: number;
}

export interface MeetingNoteItem extends SyncedRow {
  meetingId: UUID;
  content: string;
  position: number;
  processed: boolean;
  resultKind: ProcessedItemKind | null;
  resultId: UUID | null;
  processedAt: ISODate | null;
}

export interface Requirement extends SyncedRow {
  organizationId: UUID | null;
  projectId: UUID | null;
  sourceMeetingId: UUID | null;
  sourceNoteItemId: UUID | null;
  title: string;
  description: string | null;
  type: RequirementType;
  status: RequirementStatus;
}

export interface Note extends SyncedRow {
  organizationId: UUID | null;
  projectId: UUID | null;
  taskId: UUID | null;
  meetingId: UUID | null;
  requirementId: UUID | null;
  title: string | null;
  body: string;
  archivedAt: ISODate | null;
}

export interface Decision extends SyncedRow {
  organizationId: UUID | null;
  projectId: UUID | null;
  sourceMeetingId: UUID | null;
  decision: string;
  reason: string | null;
  date: ISODate;
}

export interface ActivityEntry extends SyncedRow {
  organizationId: UUID | null;
  projectId: UUID | null;
  taskId: UUID | null;
  meetingId: UUID | null;
  description: string;
  source: ActivitySource;
  occurredAt: ISODate;
}

export interface WeeklyReview {
  from: ISODate;
  to: ISODate;
  totals: {
    all: number;
    planned: number;
    unplanned: number;
    carriedForward: number;
  };
  byOrganization: { organizationId: UUID | null; count: number }[];
  planned: ActivityEntry[];
  unplanned: ActivityEntry[];
}

export interface Attachment extends SyncedRow {
  organizationId: UUID | null;
  projectId: UUID | null;
  taskId: UUID | null;
  meetingId: UUID | null;
  noteId: UUID | null;
  requirementId: UUID | null;
  kind: AttachmentKind;
  relativePath: string;
  objectKey: string | null;
  uploadedAt: ISODate | null;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  caption: string | null;
  ocrText: string | null;
  archivedAt: ISODate | null;
}

/** What `POST /attachments` hands back alongside the row. */
export interface PresignedUpload {
  objectKey: string;
  uploadUrl: string;
  expiresIn: number;
  headers: Record<string, string>;
}

export interface VoiceNote extends SyncedRow {
  organizationId: UUID | null;
  projectId: UUID | null;
  taskId: UUID | null;
  meetingId: UUID | null;
  noteId: UUID | null;
  title: string | null;
  relativePath: string;
  objectKey: string | null;
  uploadedAt: ISODate | null;
  durationMs: number;
  transcript: string | null;
  archivedAt: ISODate | null;
}
