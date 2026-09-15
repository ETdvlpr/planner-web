import { describe, expect, it } from "vitest";
import {
  addDays,
  formatDate,
  fromDateInput,
  isOverdue,
  ordinal,
  recurrenceLabel,
  toDateInput,
} from "../format";

describe("recurrenceLabel", () => {
  it("names the simple frequencies", () => {
    expect(recurrenceLabel({ frequency: "daily" })).toBe("Daily");
    expect(recurrenceLabel({ frequency: "weekly", interval: 2 })).toBe(
      "Every 2 weeks",
    );
    expect(recurrenceLabel({ frequency: "monthly", dayOfMonth: 15 })).toBe(
      "Monthly on the 15th",
    );
    expect(recurrenceLabel({ frequency: "everyNMonths", interval: 3 })).toBe(
      "Every 3 months",
    );
  });

  it("decodes the weekday bitmask, Monday = 1 << 0", () => {
    expect(
      recurrenceLabel({
        frequency: "selectedWeekdays",
        weekdaysMask: 0b0000101,
      }),
    ).toBe("Weekly on Mon, Wed");
    expect(
      recurrenceLabel({ frequency: "selectedWeekdays", weekdaysMask: 1 << 6 }),
    ).toBe("Weekly on Sun");
  });

  it("treats an interval below 1 as 1", () => {
    expect(recurrenceLabel({ frequency: "weekly", interval: 0 })).toBe(
      "Weekly",
    );
  });
});

describe("ordinal", () => {
  it("handles the teens", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "23rd",
      "31st",
    ]);
  });
});

describe("dates", () => {
  it("names today, tomorrow and yesterday", () => {
    const now = new Date();
    expect(formatDate(now.toISOString())).toBe("Today");
    expect(formatDate(addDays(now, 1).toISOString())).toBe("Tomorrow");
    expect(formatDate(addDays(now, -1).toISOString())).toBe("Yesterday");
  });

  it("round-trips a date input as local midnight", () => {
    const iso = fromDateInput("2026-03-05")!;
    expect(toDateInput(iso)).toBe("2026-03-05");
    expect(new Date(iso).getHours()).toBe(0);
  });

  it("flags only past days as overdue", () => {
    expect(isOverdue(addDays(new Date(), -1).toISOString())).toBe(true);
    expect(isOverdue(new Date().toISOString())).toBe(false);
    expect(isOverdue(null)).toBe(false);
  });
});
