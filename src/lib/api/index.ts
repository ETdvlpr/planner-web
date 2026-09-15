import { http, type QueryParams } from "./client";
import type {
  ActivityEntry,
  ActivitySource,
  Attachment,
  AttachmentKind,
  ChecklistItem,
  DeadlinePrecision,
  Decision,
  Meeting,
  MeetingNoteItem,
  MeetingProcessingStatus,
  Note,
  OrgStatus,
  Organization,
  OrganizationSummary,
  Paginated,
  PaginationQuery,
  PresignedUpload,
  ProcessedItemKind,
  Project,
  ProjectStatus,
  RecurrenceSpec,
  Requirement,
  RequirementStatus,
  RequirementType,
  Task,
  TaskContextTag,
  TaskPriority,
  TaskStatus,
  TaskType,
  User,
  UUID,
  WeeklyReview,
} from "./types";

export * from "./client";
export * from "./types";

/**
 * One function per route, typed to the API's DTOs. Request shapes are the
 * `Create*Dto` / `Update*Dto` classes in planner-api; queries are the
 * `*QueryDto` classes. Nothing here knows about React.
 */

// ────────────────────────────────────────────────────────────────────── users

export interface UpdateProfileInput {
  displayName?: string;
  photoUrl?: string;
}

export const users = {
  me: () => http.get<User>("/users/me"),
  update: (input: UpdateProfileInput) => http.patch<User>("/users/me", input),
  deleteAccount: () => http.delete<unknown>("/users/me"),
};

// ────────────────────────────────────────────────────────────── organizations

export interface OrganizationInput {
  id?: UUID;
  name: string;
  description?: string;
  status?: OrgStatus;
  favorite?: boolean;
  iconCodePoint?: number;
  colorValue?: number;
  sortOrder?: number;
}

export interface OrganizationQuery extends PaginationQuery {
  status?: OrgStatus;
  q?: string;
}

export const organizations = {
  list: (query: OrganizationQuery = {}) =>
    http.get<Paginated<Organization>>("/organizations", query as QueryParams),
  get: (id: UUID) => http.get<Organization>(`/organizations/${id}`),
  summary: (id: UUID) =>
    http.get<OrganizationSummary>(`/organizations/${id}/summary`),
  create: (input: OrganizationInput) =>
    http.post<Organization>("/organizations", input),
  update: (id: UUID, input: Partial<OrganizationInput>) =>
    http.patch<Organization>(`/organizations/${id}`, input),
  remove: (id: UUID) => http.delete<Organization>(`/organizations/${id}`),
  restore: (id: UUID) =>
    http.post<Organization>(`/organizations/${id}/restore`),
};

// ─────────────────────────────────────────────────────────────────── projects

export interface ProjectInput {
  id?: UUID;
  organizationId?: UUID | null;
  name: string;
  description?: string;
  status?: ProjectStatus;
  favorite?: boolean;
  iconCodePoint?: number;
  colorValue?: number;
  sortOrder?: number;
}

export interface ProjectQuery extends PaginationQuery {
  status?: ProjectStatus;
  organizationId?: UUID;
  unassigned?: boolean;
  q?: string;
}

export const projects = {
  list: (query: ProjectQuery = {}) =>
    http.get<Paginated<Project>>("/projects", query as QueryParams),
  get: (id: UUID) => http.get<Project>(`/projects/${id}`),
  create: (input: ProjectInput) => http.post<Project>("/projects", input),
  update: (id: UUID, input: Partial<ProjectInput>) =>
    http.patch<Project>(`/projects/${id}`, input),
  remove: (id: UUID) => http.delete<Project>(`/projects/${id}`),
  restore: (id: UUID) => http.post<Project>(`/projects/${id}/restore`),
};

// ────────────────────────────────────────────────────────────────────── tasks

export interface TaskInput {
  id?: UUID;
  title: string;
  description?: string | null;
  type?: TaskType;
  status?: TaskStatus;
  priority?: TaskPriority;
  context?: TaskContextTag | null;
  organizationId?: UUID | null;
  projectId?: UUID | null;
  sourceMeetingId?: UUID;
  sourceRequirementId?: UUID;
  parentTaskId?: UUID;
  waitingOn?: string | null;
  deadline?: string | null;
  deadlinePrecision?: DeadlinePrecision;
  reminderAt?: string | null;
  followUpDate?: string | null;
  sortOrder?: number;
  recurrence?: RecurrenceSpec;
}

export interface TaskQuery extends PaginationQuery {
  status?: TaskStatus[];
  type?: TaskType;
  priority?: TaskPriority;
  context?: TaskContextTag;
  organizationId?: UUID;
  projectId?: UUID;
  parentTaskId?: UUID;
  recurringSeriesId?: UUID;
  inbox?: boolean;
  openOnly?: boolean;
  dueBefore?: string;
  q?: string;
}

export interface ChecklistItemInput {
  id?: UUID;
  label: string;
  done?: boolean;
  position?: number;
}

/**
 * `POST /tasks/:id/complete` returns the completed task and, for a recurring
 * task, the next occurrence it spawned.
 */
export interface CompleteTaskResult {
  task: Task;
  next: Task | null;
}

export const tasks = {
  list: (query: TaskQuery = {}) =>
    http.get<Paginated<Task>>("/tasks", query as QueryParams),
  get: (id: UUID) => http.get<Task>(`/tasks/${id}`),
  series: (seriesId: UUID) => http.get<Task[]>(`/tasks/series/${seriesId}`),
  create: (input: TaskInput) => http.post<Task>("/tasks", input),
  update: (id: UUID, input: Partial<TaskInput>) =>
    http.patch<Task>(`/tasks/${id}`, input),
  complete: (id: UUID, completedAt?: string) =>
    http.post<CompleteTaskResult>(`/tasks/${id}/complete`, {
      completedAt,
    }),
  reopen: (id: UUID) => http.post<Task>(`/tasks/${id}/reopen`),
  drop: (id: UUID) => http.post<Task>(`/tasks/${id}/drop`),
  carryForward: (id: UUID) => http.post<Task>(`/tasks/${id}/carry-forward`),
  remove: (id: UUID) => http.delete<Task>(`/tasks/${id}`),
  restore: (id: UUID) => http.post<Task>(`/tasks/${id}/restore`),

  checklist: (taskId: UUID) =>
    http.get<ChecklistItem[]>(`/tasks/${taskId}/checklist`),
  addChecklistItem: (taskId: UUID, input: ChecklistItemInput) =>
    http.post<ChecklistItem>(`/tasks/${taskId}/checklist`, input),
  updateChecklistItem: (itemId: UUID, input: Partial<ChecklistItemInput>) =>
    http.patch<ChecklistItem>(`/tasks/checklist/${itemId}`, input),
  removeChecklistItem: (itemId: UUID) =>
    http.delete<ChecklistItem>(`/tasks/checklist/${itemId}`),
};

// ─────────────────────────────────────────────────────────────────── meetings

export interface MeetingInput {
  id?: UUID;
  title: string;
  date: string;
  organizationId?: UUID | null;
  projectId?: UUID | null;
  attendees?: string | null;
  rawNotes?: string;
}

export interface MeetingQuery extends PaginationQuery {
  organizationId?: UUID;
  projectId?: UUID;
  from?: string;
  to?: string;
  q?: string;
}

export interface NoteItemInput {
  id?: UUID;
  content: string;
  position?: number;
}

export const meetings = {
  list: (query: MeetingQuery = {}) =>
    http.get<Paginated<Meeting>>("/meetings", query as QueryParams),
  get: (id: UUID) => http.get<Meeting>(`/meetings/${id}`),
  create: (input: MeetingInput) => http.post<Meeting>("/meetings", input),
  update: (id: UUID, input: Partial<MeetingInput>) =>
    http.patch<Meeting>(`/meetings/${id}`, input),
  remove: (id: UUID) => http.delete<Meeting>(`/meetings/${id}`),
  status: (id: UUID) =>
    http.get<MeetingProcessingStatus>(`/meetings/${id}/status`),

  noteItems: (id: UUID) =>
    http.get<MeetingNoteItem[]>(`/meetings/${id}/note-items`),
  addNoteItem: (id: UUID, input: NoteItemInput) =>
    http.post<MeetingNoteItem>(`/meetings/${id}/note-items`, input),
  split: (id: UUID, replace = false) =>
    http.post<MeetingNoteItem[]>(`/meetings/${id}/split`, { replace }),
  updateNoteItem: (
    itemId: UUID,
    input: Partial<NoteItemInput> & { processed?: boolean },
  ) => http.patch<MeetingNoteItem>(`/meetings/note-items/${itemId}`, input),
  markProcessed: (
    itemId: UUID,
    resultKind: ProcessedItemKind,
    resultId?: UUID,
  ) =>
    http.post<MeetingNoteItem>(`/meetings/note-items/${itemId}/processed`, {
      resultKind,
      resultId,
    }),
  removeNoteItem: (itemId: UUID) =>
    http.delete<MeetingNoteItem>(`/meetings/note-items/${itemId}`),
};

// ─────────────────────────────────────────────────────────────── requirements

export interface RequirementInput {
  id?: UUID;
  title: string;
  description?: string | null;
  type?: RequirementType;
  status?: RequirementStatus;
  organizationId?: UUID | null;
  projectId?: UUID | null;
  sourceMeetingId?: UUID;
  sourceNoteItemId?: UUID;
}

export interface RequirementQuery extends PaginationQuery {
  status?: RequirementStatus;
  type?: RequirementType;
  organizationId?: UUID;
  projectId?: UUID;
  sourceMeetingId?: UUID;
  openOnly?: boolean;
  q?: string;
}

export const requirements = {
  list: (query: RequirementQuery = {}) =>
    http.get<Paginated<Requirement>>("/requirements", query as QueryParams),
  get: (id: UUID) => http.get<Requirement>(`/requirements/${id}`),
  create: (input: RequirementInput) =>
    http.post<Requirement>("/requirements", input),
  update: (id: UUID, input: Partial<RequirementInput>) =>
    http.patch<Requirement>(`/requirements/${id}`, input),
  remove: (id: UUID) => http.delete<Requirement>(`/requirements/${id}`),
};

// ────────────────────────────────────────────────────────────────────── notes

export interface NoteInput {
  id?: UUID;
  title?: string | null;
  body: string;
  organizationId?: UUID | null;
  projectId?: UUID | null;
  taskId?: UUID;
  meetingId?: UUID;
  requirementId?: UUID;
}

export interface NoteQuery extends PaginationQuery {
  organizationId?: UUID;
  projectId?: UUID;
  taskId?: UUID;
  meetingId?: UUID;
  requirementId?: UUID;
  includeArchived?: boolean;
  q?: string;
}

export const notes = {
  list: (query: NoteQuery = {}) =>
    http.get<Paginated<Note>>("/notes", query as QueryParams),
  get: (id: UUID) => http.get<Note>(`/notes/${id}`),
  create: (input: NoteInput) => http.post<Note>("/notes", input),
  update: (id: UUID, input: Partial<NoteInput>) =>
    http.patch<Note>(`/notes/${id}`, input),
  archive: (id: UUID) => http.post<Note>(`/notes/${id}/archive`),
  unarchive: (id: UUID) => http.post<Note>(`/notes/${id}/unarchive`),
  remove: (id: UUID) => http.delete<Note>(`/notes/${id}`),
};

// ────────────────────────────────────────────────────────────────── decisions

export interface DecisionInput {
  id?: UUID;
  decision: string;
  reason?: string | null;
  date?: string;
  organizationId?: UUID | null;
  projectId?: UUID | null;
  sourceMeetingId?: UUID;
}

export interface DecisionQuery extends PaginationQuery {
  organizationId?: UUID;
  projectId?: UUID;
  sourceMeetingId?: UUID;
  from?: string;
  to?: string;
  q?: string;
}

export const decisions = {
  list: (query: DecisionQuery = {}) =>
    http.get<Paginated<Decision>>("/decisions", query as QueryParams),
  get: (id: UUID) => http.get<Decision>(`/decisions/${id}`),
  create: (input: DecisionInput) => http.post<Decision>("/decisions", input),
  update: (id: UUID, input: Partial<DecisionInput>) =>
    http.patch<Decision>(`/decisions/${id}`, input),
  remove: (id: UUID) => http.delete<Decision>(`/decisions/${id}`),
};

// ─────────────────────────────────────────────────────────────────── activity

export interface ActivityInput {
  id?: UUID;
  description: string;
  source?: ActivitySource;
  occurredAt?: string;
  organizationId?: UUID | null;
  projectId?: UUID | null;
  taskId?: UUID;
  meetingId?: UUID;
}

export interface ActivityQuery extends PaginationQuery {
  source?: ActivitySource;
  organizationId?: UUID;
  projectId?: UUID;
  from?: string;
  to?: string;
  q?: string;
}

export const activity = {
  list: (query: ActivityQuery = {}) =>
    http.get<Paginated<ActivityEntry>>("/activity", query as QueryParams),
  create: (input: ActivityInput) =>
    http.post<ActivityEntry>("/activity", input),
  update: (id: UUID, input: Partial<ActivityInput>) =>
    http.patch<ActivityEntry>(`/activity/${id}`, input),
  remove: (id: UUID) => http.delete<ActivityEntry>(`/activity/${id}`),
  review: (from?: string, to?: string) =>
    http.get<WeeklyReview>("/activity/review", { from, to }),
};

// ──────────────────────────────────────────────────────────────── attachments

export interface AttachmentInput {
  id?: UUID;
  kind: AttachmentKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  caption?: string;
  organizationId?: UUID | null;
  projectId?: UUID | null;
  taskId?: UUID;
  meetingId?: UUID;
  noteId?: UUID;
  requirementId?: UUID;
}

export interface AttachmentQuery extends PaginationQuery {
  kind?: AttachmentKind;
  taskId?: UUID;
  meetingId?: UUID;
  projectId?: UUID;
  noteId?: UUID;
  requirementId?: UUID;
}

export const attachments = {
  list: (query: AttachmentQuery = {}) =>
    http.get<Paginated<Attachment>>("/attachments", query as QueryParams),
  get: (id: UUID) => http.get<Attachment>(`/attachments/${id}`),
  create: (input: AttachmentInput) =>
    http.post<{ attachment: Attachment; upload: PresignedUpload }>(
      "/attachments",
      input,
    ),
  confirm: (id: UUID, objectKey: string) =>
    http.post<Attachment>(`/attachments/${id}/confirm`, { objectKey }),
  url: (id: UUID) => http.get<{ url: string }>(`/attachments/${id}/url`),
  update: (id: UUID, input: Partial<Pick<AttachmentInput, "caption">>) =>
    http.patch<Attachment>(`/attachments/${id}`, input),
  remove: (id: UUID) => http.delete<Attachment>(`/attachments/${id}`),
};
