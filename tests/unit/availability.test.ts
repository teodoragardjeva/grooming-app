import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSlots, resolveWindows } from "../../src/lib/availability/engine.ts";
import type { Interval } from "../../src/lib/availability/engine.ts";
import { cancellationDeadline, localDateTimeToUtc, localParts } from "../../src/lib/time/zone.ts";

const DATE = "2026-12-02"; // Wednesday, Sofia = UTC+2
const NOW = new Date("2026-11-30T08:00:00Z"); // far enough ahead for notice
const settings = { slotMinutes: 15, minNoticeMinutes: 120, horizonDays: 30 };
const at = (hhmm: string, date = DATE) => localDateTimeToUtc(date, hhmm);
const iv = (a: string, b: string): Interval => ({ start: at(a), end: at(b) });
const hhmm = (d: Date) =>
  `${String(localParts(d).hour).padStart(2, "0")}:${String(localParts(d).minute).padStart(2, "0")}`;

function slots(opts: {
  windows?: { start: string; end: string }[];
  busy?: Interval[];
  blocked?: Interval[];
  duration: number;
  prep?: number;
  cleanup?: number;
  now?: Date;
  date?: string;
}) {
  return computeSlots({
    date: opts.date ?? DATE,
    windows: opts.windows ?? [{ start: "12:00", end: "13:00" }],
    blocked: opts.blocked ?? [],
    busy: opts.busy ?? [],
    timing: { durationMinutes: opts.duration, prepMinutes: opts.prep ?? 0, cleanupMinutes: opts.cleanup ?? 0 },
    settings,
    now: opts.now ?? NOW,
  });
}
const free = (s: ReturnType<typeof slots>) => s.filter((x) => x.available).map((x) => hhmm(x.start));

test("15m service in a 12:00-13:00 gap: 12:00, 12:15, 12:30, 12:45", () => {
  assert.deepEqual(free(slots({ duration: 15 })), ["12:00", "12:15", "12:30", "12:45"]);
});
test("30m service: 12:00, 12:15, 12:30 (12:45 not offered)", () => {
  assert.deepEqual(free(slots({ duration: 30 })), ["12:00", "12:15", "12:30"]);
});
test("60m service fits only at 12:00", () => {
  assert.deepEqual(free(slots({ duration: 60 })), ["12:00"]);
});
test("90m service has no slot in a 60m gap", () => {
  assert.equal(slots({ duration: 90 }).length, 0);
});
test("existing allocation 12:00-13:30: 13:30 allowed, 13:15 rejected (60m, no buffer)", () => {
  const s = slots({
    windows: [{ start: "09:00", end: "19:00" }],
    busy: [iv("12:00", "13:30")],
    duration: 60,
  });
  const by = (t: string) => s.find((x) => hhmm(x.start) === t)!;
  assert.equal(by("13:30").available, true);
  assert.equal(by("13:15").available, false);
  assert.equal(by("13:15").reason, "booked");
  assert.equal(by("11:00").available, true); // ends exactly 12:00 (half-open)
  assert.equal(by("11:15").available, false);
});
test("60m + 15m cleanup occupies 75 minutes; customer still sees 60", () => {
  const s = slots({ windows: [{ start: "12:00", end: "14:00" }], duration: 60, cleanup: 15 });
  const first = s[0];
  assert.equal((first.allocEnd.getTime() - first.allocStart.getTime()) / 60000, 75);
  assert.equal((first.end.getTime() - first.start.getTime()) / 60000, 60);
});
test("cleanup buffer: next booking earliest 13:15 after 12:00 (60m + 15m)", () => {
  const s = slots({
    windows: [{ start: "09:00", end: "19:00" }],
    busy: [{ start: at("12:00"), end: at("13:15") }],
    duration: 60,
    cleanup: 15,
  });
  const by = (t: string) => s.find((x) => hhmm(x.start) === t)!;
  assert.equal(by("13:00").available, false);
  assert.equal(by("13:15").available, true);
});
test("prep buffer may reach before opening time (buffers only count between procedures)", () => {
  const s = slots({ windows: [{ start: "09:00", end: "12:00" }], duration: 30, prep: 15 });
  assert.equal(s[0].available, true);
  assert.equal(hhmm(s[0].start), "09:00");
  assert.equal(hhmm(s[0].allocStart), "08:45");
});
test("cleanup buffer may run past closing time, but the procedure must still end by closing", () => {
  const s = slots({ windows: [{ start: "09:00", end: "10:00" }], duration: 45, cleanup: 30 });
  assert.deepEqual(free(s), ["09:00", "09:15"]);
  assert.equal(hhmm(s[0].allocEnd), "10:15");
});
test("buffer past closing still collides with a booking after it", () => {
  const s = slots({ windows: [{ start: "09:00", end: "10:00" }], duration: 45, cleanup: 30, busy: [{ start: at("10:00"), end: at("10:10") }] });
  assert.deepEqual(free(s), []);
});
test("minimum notice: 2 hours", () => {
  const now = new Date(at("10:00"));
  const s = slots({ windows: [{ start: "09:00", end: "19:00" }], duration: 15, now });
  const by = (t: string) => s.find((x) => hhmm(x.start) === t)!;
  assert.equal(by("11:45").reason, "too_soon");
  assert.equal(by("12:00").available, true);
});
test("booking horizon: 30 days", () => {
  const s = slots({ date: "2027-01-05", windows: [{ start: "09:00", end: "10:00" }], duration: 15 });
  assert.ok(s.length > 0 && s.every((x) => x.reason === "too_far"));
});
test("lunch break (two windows) and blocked interval remove slots", () => {
  const s = slots({
    windows: [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "19:00" }],
    blocked: [iv("15:00", "16:00")],
    duration: 60,
  });
  const times = free(s);
  assert.ok(!times.includes("12:15")); // would run into lunch
  assert.ok(times.includes("12:00") && times.includes("14:00"));
  assert.ok(!times.includes("15:00") && !times.includes("15:30") && times.includes("16:00"));
});
test("resolveWindows: weekly, closed override, special-hours override", () => {
  const weekly = [{ weekday: 3, start: "09:00", end: "19:00" }];
  assert.deepEqual(resolveWindows(DATE, weekly, []), [{ start: "09:00", end: "19:00" }]);
  assert.deepEqual(resolveWindows(DATE, weekly, [{ date: DATE, isClosed: true }]), []);
  assert.deepEqual(
    resolveWindows(DATE, weekly, [{ date: DATE, isClosed: false, start: "10:00", end: "12:00" }]),
    [{ start: "10:00", end: "12:00" }],
  );
  assert.deepEqual(resolveWindows("2026-12-06", weekly, []), []); // Sunday not configured
});
test("DST: Europe/Sofia offsets (winter +2, summer +3)", () => {
  assert.equal(localDateTimeToUtc("2026-12-02", "10:00").toISOString(), "2026-12-02T08:00:00.000Z");
  assert.equal(localDateTimeToUtc("2026-03-29", "10:00").toISOString(), "2026-03-29T07:00:00.000Z");
  assert.equal(localDateTimeToUtc("2026-10-25", "10:00").toISOString(), "2026-10-25T08:00:00.000Z");
  assert.equal(localDateTimeToUtc("2026-07-01", "10:00").toISOString(), "2026-07-01T07:00:00.000Z");
});
test("DST: a day with the spring-forward gap lists slots at correct UTC instants", () => {
  const s = slots({ date: "2026-03-29", windows: [{ start: "10:00", end: "11:00" }], duration: 60, now: new Date("2026-03-20T00:00:00Z") });
  assert.equal(s[0].start.toISOString(), "2026-03-29T07:00:00.000Z");
});
test("cancellation deadline uses studio wall clock (Fri 15:00 -> Thu 15:00)", () => {
  assert.equal(cancellationDeadline(at("15:00", "2026-12-04"), 24).toISOString(), at("15:00", "2026-12-03").toISOString());
  // across spring-forward: Sunday 15:00 EEST -> Saturday 15:00 EET (13:00Z), not 12:00Z
  assert.equal(cancellationDeadline(localDateTimeToUtc("2026-03-29", "15:00"), 24).toISOString(), "2026-03-28T13:00:00.000Z");
});
