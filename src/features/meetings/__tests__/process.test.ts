import { describe, expect, it, vi, beforeEach } from "vitest";

const { tasks, requirements, decisions, notes, meetings } = vi.hoisted(() => ({
  tasks: { create: vi.fn() },
  requirements: { create: vi.fn() },
  decisions: { create: vi.fn() },
  notes: { create: vi.fn() },
  meetings: { markProcessed: vi.fn() },
}));
vi.mock("@/lib/api", () => ({
  tasks,
  requirements,
  decisions,
  notes,
  meetings,
}));

import {
  createsRequirement,
  createsTask,
  processLine,
  requirementTypeFor,
} from "../process-dialog";
import type { Meeting } from "@/lib/api";

const meeting = {
  id: "m1",
  date: "2026-09-13T10:00:00.000Z",
  organizationId: "org",
  projectId: "proj",
} as Meeting;

describe("kind mapping (mirrors MeetingProcessingService on mobile)", () => {
  it("routes kinds to the entity they create", () => {
    expect(createsTask("task")).toBe(true);
    expect(createsTask("followUp")).toBe(true);
    expect(createsRequirement("feature")).toBe(true);
    expect(createsRequirement("question")).toBe(true);
    expect(createsRequirement("decision")).toBe(false);
    expect(requirementTypeFor("idea")).toBe("idea");
    expect(requirementTypeFor("requirement")).toBe("requirement");
  });
});

describe("processLine", () => {
  beforeEach(() => {
    for (const m of [
      tasks.create,
      requirements.create,
      decisions.create,
      notes.create,
      meetings.markProcessed,
    ]) {
      m.mockReset();
    }
  });

  it("creates a follow-up task in Next with the meeting as its source, then marks the line", async () => {
    tasks.create.mockResolvedValue({ id: "t1", title: "Chase finance" });
    meetings.markProcessed.mockResolvedValue({});

    const result = await processLine(meeting, {
      kind: "followUp",
      title: "  Chase finance ",
      organizationId: "org",
      projectId: "proj",
      noteItemId: "line1",
    });

    expect(tasks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Chase finance",
        type: "followUp",
        status: "next",
        sourceMeetingId: "m1",
        organizationId: "org",
        projectId: "proj",
      }),
    );
    expect(meetings.markProcessed).toHaveBeenCalledWith(
      "line1",
      "followUp",
      "t1",
    );
    expect(result).toEqual({
      kind: "followUp",
      id: "t1",
      title: "Chase finance",
    });
  });

  it("dates a decision on the meeting and keeps the reason", async () => {
    decisions.create.mockResolvedValue({
      id: "d1",
      decision: "Ship web first",
    });
    await processLine(meeting, {
      kind: "decision",
      title: "Ship web first",
      description: "Billing can wait",
      organizationId: "org",
      projectId: null,
    });
    expect(decisions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "Ship web first",
        reason: "Billing can wait",
        date: meeting.date,
        sourceMeetingId: "m1",
      }),
    );
    expect(meetings.markProcessed).not.toHaveBeenCalled();
  });

  it("uses a long line as the note body, not its title", async () => {
    const long = "x".repeat(80);
    notes.create.mockResolvedValue({ id: "n1" });
    await processLine(meeting, {
      kind: "note",
      title: long,
      organizationId: null,
      projectId: null,
    });
    expect(notes.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: null, body: long, meetingId: "m1" }),
    );
  });
});
