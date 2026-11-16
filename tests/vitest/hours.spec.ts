import { describe, expect, it } from "vitest";
import { formatWeeklyHours } from "../../src/lib/content/hours.ts";

const row = (weekday: number, s: string, e: string) => ({ weekday, start_time: s, end_time: e });

describe("formatWeeklyHours", () => {
  it("groups consecutive days with equal hours and skips closed days", () => {
    const rows = [1, 2, 3, 4, 5].map((d) => row(d, "09:00:00", "18:00:00")).concat([row(6, "10:00:00", "14:00:00")]);
    expect(formatWeeklyHours(rows, "en")).toEqual(["Mon–Fri: 09:00–18:00", "Sat: 10:00–14:00"]);
  });
  it("lists split shifts on one line and handles two-day groups", () => {
    const rows = [row(1, "09:00", "12:00"), row(1, "13:00", "18:00"), row(2, "09:00", "12:00"), row(2, "13:00", "18:00")];
    expect(formatWeeklyHours(rows, "en")).toEqual(["Mon, Tue: 09:00–12:00, 13:00–18:00"]);
  });
  it("is empty without a schedule and uses Bulgarian day names", () => {
    expect(formatWeeklyHours([], "bg")).toEqual([]);
    expect(formatWeeklyHours([row(1, "09:00", "10:00")], "bg")[0]).toMatch(/^пн/i);
  });
});
