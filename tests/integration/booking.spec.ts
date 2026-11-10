import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { listAvailableDays, listSlots } from "../../src/lib/booking/slots.ts";
import { cancelBookingByToken, confirmBookingByToken, createPublicBooking, tokenSummary } from "../../src/lib/booking/public.ts";
import { adminCancelAppointment, adminCreateAppointment, adminRescheduleAppointment } from "../../src/lib/booking/admin.ts";
import { allowRequest } from "../../src/lib/security/rate-limit.ts";
import { bookingRequestSchema } from "../../src/lib/booking/schemas.ts";
import { FULL, NAIL, NOW, D, R1, RecordingMailer, bookingInput, makeDeps, pool, resetDynamic, rpc, tokenFromUrl } from "./harness.ts";

const at = (iso: string) => new Date(iso);
beforeEach(resetDynamic);
afterAll(() => pool.end());

describe("slot listing (server side)", () => {
  it("lists a 15m grid across the working day and marks booked/adjacent slots correctly", async () => {
    const deps = makeDeps();
    const before = await listSlots(deps, { serviceId: NAIL, variantId: null, date: D });
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(before.slots[0]!.start).toBe("2026-12-02T07:00:00.000Z"); // 09:00 Sofia
    expect(before.slots.at(-1)!.start).toBe("2026-12-02T16:45:00.000Z"); // 18:45 + 15m = 19:00
    expect(before.slots.every((s) => s.available)).toBe(true);

    await adminCreateAppointment(deps, "00000000-0000-4000-8000-0000000000ff", {
      serviceId: NAIL, variantId: null, startAt: `${D}T12:00:00+02:00`, name: "X", phone: null, email: null,
      dogName: null, notes: null, adminNotes: null, overrideMinNotice: false, sendEmail: false, locale: "bg",
    });
    const after = await listSlots(deps, { serviceId: NAIL, variantId: null, date: D });
    if (!after.ok) throw new Error("expected ok");
    const bySofia = (h: string) => after.slots.find((s) => s.start === new Date(`${D}T${h}:00+02:00`).toISOString())!;
    expect(bySofia("12:00").available).toBe(false);
    expect(bySofia("12:00").reason).toBe("booked");
    expect(bySofia("11:45").available).toBe(true); // ends exactly at 12:00 (half-open)
    expect(bySofia("12:15").available).toBe(true);
  });

  it("size-based services need a variant and use its duration", async () => {
    const deps = makeDeps();
    expect(await listSlots(deps, { serviceId: FULL, variantId: null, date: D })).toEqual({ ok: false, error: "variant_required" });
    const { rows } = await pool.query("select id from service_variants where service_id=$1 and size_key='medium'", [FULL]);
    const r = await listSlots(deps, { serviceId: FULL, variantId: rows[0].id, date: D });
    if (!r.ok) throw new Error("expected ok");
    expect(r.durationMinutes).toBe(90);
    expect(r.priceCents).toBe(7000);
    expect(r.slots.at(-1)!.start).toBe("2026-12-02T15:30:00.000Z"); // 17:30 + 90m = 19:00
  });

  it("applies minimum notice (2h) and the horizon", async () => {
    const deps = makeDeps();
    const today = await listSlots(deps, { serviceId: NAIL, variantId: null, date: "2026-11-30" });
    if (!today.ok) throw new Error("expected ok");
    const s1100 = today.slots.find((s) => s.start === "2026-11-30T09:00:00.000Z")!; // 11:00 Sofia, only 1h ahead
    const s1200 = today.slots.find((s) => s.start === "2026-11-30T10:00:00.000Z")!; // exactly 2h ahead
    expect(s1100.reason).toBe("too_soon");
    expect(s1200.available).toBe(true);
    const far = await listSlots(deps, { serviceId: NAIL, variantId: null, date: "2027-01-15" });
    if (!far.ok) throw new Error("expected ok");
    expect(far.slots.every((s) => s.reason === "too_far")).toBe(true);
  });

  it("closed days, Sundays and blocked time are not offered", async () => {
    const deps = makeDeps();
    await rpc("admin_set_override_range", { p_resource: R1, p_from: "2026-12-03", p_to: "2026-12-03", p_closed: true, p_start: null, p_end: null, p_note: "Празник", p_confirm_conflicts: false, p_actor: null, p_now: NOW.toISOString() });
    const days = await listAvailableDays(deps, { serviceId: NAIL, variantId: null, from: "2026-12-01", to: "2026-12-08" });
    if (!days.ok) throw new Error("expected ok");
    expect(days.days).toEqual(["2026-12-01", "2026-12-02", "2026-12-04", "2026-12-05", "2026-12-07", "2026-12-08"]);
    // 12-03 closed (override), 12-06 is a Sunday.
  });
});

describe("public booking lifecycle", () => {
  it("hold -> email with link -> confirm -> final email with cancel link; repeat click is idempotent", async () => {
    const deps = makeDeps();
    const created = await createPublicBooking(deps, bookingInput());
    expect(created.ok).toBe(true);
    const req = deps.mailer.last("confirmation_request");
    expect(req?.to).toBe("maria@example.com");
    expect(req?.content.text).toContain("https://example.test/booking/confirm?token=");
    expect(req?.content.text).toContain("Плащане на място в студиото");
    const token = tokenFromUrl(req);

    const c1 = await confirmBookingByToken(deps, token);
    expect(c1).toEqual({ ok: true, alreadyConfirmed: false, emailSent: true });
    expect(deps.mailer.last("booking_confirmed")?.content.text).toContain("/booking/cancel?token=");
    const sentBefore = deps.mailer.sent.length;

    const c2 = await confirmBookingByToken(deps, token);
    expect(c2).toEqual({ ok: true, alreadyConfirmed: true, emailSent: true });
    expect(deps.mailer.sent.length).toBe(sentBefore); // no duplicate email
    const { rows } = await pool.query("select status from appointments");
    expect(rows).toEqual([{ status: "confirmed" }]);
  });

  it("English bookings get English emails and /en links", async () => {
    const deps = makeDeps();
    await createPublicBooking(deps, bookingInput({ locale: "en" }));
    const req = deps.mailer.last("confirmation_request")!;
    expect(req.content.subject).toContain("Please confirm your appointment");
    expect(req.content.text).toContain("https://example.test/en/booking/confirm?token=");
  });

  it("rejects bookings closer than 2 hours", async () => {
    const r = await createPublicBooking(makeDeps(), bookingInput({ startAt: "2026-11-30T11:00:00+02:00" }));
    expect(r).toEqual({ ok: false, error: "too_soon" });
  });

  it("confirmation fails after the 10-minute hold and the slot becomes bookable again (no cron)", async () => {
    const d1 = makeDeps();
    await createPublicBooking(d1, bookingInput());
    const token = tokenFromUrl(d1.mailer.last("confirmation_request"));
    const later = makeDeps(new Date(NOW.getTime() + 11 * 60000), d1.mailer);
    expect(await confirmBookingByToken(later, token)).toEqual({ ok: false, error: "expired" });
    const again = await createPublicBooking(later, bookingInput({ email: "other@example.com" }));
    expect(again.ok).toBe(true);
  });

  it("an email failure at request time frees the hold and allows a clean retry", async () => {
    const mailer = new RecordingMailer();
    mailer.failNext = 1;
    const deps = makeDeps(NOW, mailer);
    expect(await createPublicBooking(deps, bookingInput())).toEqual({ ok: false, error: "email_failed" });
    const { rows } = await pool.query("select count(*)::int n from appointment_allocations");
    expect(rows[0].n).toBe(0);
    expect((await createPublicBooking(deps, bookingInput())).ok).toBe(true);
    const alloc = await pool.query("select count(*)::int n from appointment_allocations");
    expect(alloc.rows[0].n).toBe(1); // no duplicate allocation
  });

  it("a failed final-confirmation email never undoes the confirmation and is retried on the next click", async () => {
    const mailer = new RecordingMailer();
    const deps = makeDeps(NOW, mailer);
    await createPublicBooking(deps, bookingInput());
    const token = tokenFromUrl(mailer.last("confirmation_request"));
    mailer.failNext = 1;
    expect(await confirmBookingByToken(deps, token)).toEqual({ ok: true, alreadyConfirmed: false, emailSent: false });
    expect((await pool.query("select status from appointments")).rows[0].status).toBe("confirmed");
    expect(await confirmBookingByToken(deps, token)).toEqual({ ok: true, alreadyConfirmed: true, emailSent: true });
    expect(mailer.last("booking_confirmed")).toBeTruthy();
  });

  it("exactly one of many simultaneous requests gets the slot", async () => {
    const deps = makeDeps();
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => createPublicBooking(deps, bookingInput({ email: `p${i}@example.com`, name: `Клиент ${i}` }))),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.error === "slot_taken")).toHaveLength(9);
    expect((await pool.query("select count(*)::int n from appointment_allocations")).rows[0].n).toBe(1);
  });

  it("token summary exposes no contact data", async () => {
    const deps = makeDeps();
    await createPublicBooking(deps, bookingInput());
    const token = tokenFromUrl(deps.mailer.last("confirmation_request"));
    const s = await tokenSummary(deps, "confirm", token);
    expect(s.ok).toBe(true);
    expect(JSON.stringify(s)).not.toMatch(/maria@example.com|359 88/);
    expect(await tokenSummary(deps, "confirm", "x".repeat(43))).toEqual({ ok: false, error: "invalid_token" });
  });
});

describe("self-service cancellation (24h)", () => {
  async function confirmed(mailer = new RecordingMailer(), now = NOW) {
    const deps = makeDeps(now, mailer);
    await createPublicBooking(deps, bookingInput());
    await confirmBookingByToken(deps, tokenFromUrl(mailer.last("confirmation_request")));
    return { deps, cancelToken: tokenFromUrl(mailer.last("booking_confirmed")), mailer };
  }

  it("works at >= 24h before the start, frees the slot, keeps the record and emails", async () => {
    const { deps, cancelToken, mailer } = await confirmed();
    const r = await cancelBookingByToken(deps, cancelToken);
    expect(r).toEqual({ ok: true, alreadyCancelled: false, emailSent: true });
    expect(mailer.last("booking_cancelled")).toBeTruthy();
    expect((await pool.query("select status from appointments")).rows[0].status).toBe("cancelled");
    expect((await pool.query("select count(*)::int n from appointment_allocations")).rows[0].n).toBe(0);
    expect((await cancelBookingByToken(deps, cancelToken)).ok).toBe(true); // idempotent
  });

  it("an email failure does not roll back the cancellation", async () => {
    const { deps, cancelToken, mailer } = await confirmed();
    mailer.failAll = true;
    expect(await cancelBookingByToken(deps, cancelToken)).toEqual({ ok: true, alreadyCancelled: false, emailSent: false });
    expect((await pool.query("select status from appointments")).rows[0].status).toBe("cancelled");
  });

  it("is refused with less than 24h left", async () => {
    const { cancelToken, mailer } = await confirmed();
    // Appointment 2026-12-02 12:00 Sofia; deadline 2026-12-01 12:00 Sofia = 10:00Z.
    const late = makeDeps(at("2026-12-01T10:00:01Z"), mailer);
    const r = await cancelBookingByToken(late, cancelToken);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("too_late");
    expect((await pool.query("select status from appointments")).rows[0].status).toBe("confirmed");
    const onTime = makeDeps(at("2026-12-01T10:00:00Z"), mailer);
    expect((await cancelBookingByToken(onTime, cancelToken)).ok).toBe(true);
  });

  it("unknown tokens are rejected", async () => {
    expect(await cancelBookingByToken(makeDeps(), "z".repeat(43))).toMatchObject({ ok: false, error: "invalid_token" });
  });
});

describe("admin operations", () => {
  const actor = "00000000-0000-4000-8000-0000000000ff";
  const base = { variantId: null, name: "Админ Клиент", phone: "+359 88 111 1111", email: "c@example.com", dogName: null, notes: null, adminNotes: "бележка", overrideMinNotice: false, sendEmail: true, locale: "bg" as const, serviceId: NAIL };

  it("manual booking is confirmed immediately (no email confirmation) and can email the customer", async () => {
    const deps = makeDeps();
    const r = await adminCreateAppointment(deps, actor, { ...base, startAt: `${D}T10:00:00+02:00` });
    expect(r.ok).toBe(true);
    const row = (await pool.query("select status, source from appointments")).rows[0];
    expect(row).toEqual({ status: "confirmed", source: "admin" });
    expect(deps.mailer.last("booking_confirmed")).toBeTruthy();
    expect(deps.mailer.last("confirmation_request")).toBeUndefined();
  });

  it("admin may override minimum notice but never overlap", async () => {
    const deps = makeDeps();
    const soon = `2026-11-30T11:00:00+02:00`;
    expect((await adminCreateAppointment(deps, actor, { ...base, startAt: soon })).ok).toBe(false);
    expect((await adminCreateAppointment(deps, actor, { ...base, startAt: soon, overrideMinNotice: true, sendEmail: false })).ok).toBe(true);
    const overlap = await adminCreateAppointment(deps, actor, { ...base, startAt: soon, overrideMinNotice: true, sendEmail: false });
    expect(overlap).toEqual({ ok: false, error: "slot_taken" });
  });

  it("cancel overrides the 24h rule, frees the interval, keeps history; email failure is reported but not fatal", async () => {
    const deps = makeDeps(at("2026-12-02T09:00:00Z")); // 1h before an 12:00 booking
    const c = await adminCreateAppointment(makeDeps(), actor, { ...base, startAt: `${D}T12:00:00+02:00`, sendEmail: false });
    if (!c.ok) throw new Error("setup");
    deps.mailer.failAll = true;
    const r = await adminCancelAppointment(deps, actor, c.appointmentId, "Болест", true);
    expect(r).toMatchObject({ ok: true, email: "failed" });
    const row = (await pool.query("select status, cancelled_by, cancellation_reason from appointments")).rows[0];
    expect(row).toEqual({ status: "cancelled", cancelled_by: "admin", cancellation_reason: "Болест" });
    const audit = await pool.query("select count(*)::int n from audit_logs where table_name='appointments' and action='UPDATE'");
    expect(audit.rows[0].n).toBeGreaterThan(0);
  });

  it("reschedule is atomic and refuses overlaps", async () => {
    const deps = makeDeps();
    const a = await adminCreateAppointment(deps, actor, { ...base, startAt: `${D}T10:00:00+02:00`, sendEmail: false });
    const b = await adminCreateAppointment(deps, actor, { ...base, startAt: `${D}T11:00:00+02:00`, sendEmail: false });
    if (!a.ok || !b.ok) throw new Error("setup");
    expect(await adminRescheduleAppointment(deps, actor, b.appointmentId, `${D}T10:00:00+02:00`, false, false)).toEqual({ ok: false, error: "slot_taken" });
    const moved = await adminRescheduleAppointment(deps, actor, b.appointmentId, `${D}T14:00:00+02:00`, false, true);
    expect(moved).toMatchObject({ ok: true });
    expect(deps.mailer.last("booking_rescheduled")).toBeTruthy();
    const rows = (await pool.query("select lower(during) s from appointment_allocations order by 1")).rows;
    expect(rows).toHaveLength(2);
  });

  it("catalog edits never rewrite existing appointment snapshots", async () => {
    const deps = makeDeps();
    await adminCreateAppointment(deps, actor, { ...base, startAt: `${D}T10:00:00+02:00`, sendEmail: false });
    await pool.query("update services set fixed_price_cents = 9900, fixed_duration_minutes = 45, name_bg = 'Ново име' where id = $1", [NAIL]);
    const row = (await pool.query("select price_cents, duration_minutes, service_name_bg from appointments")).rows[0];
    expect(row).toEqual({ price_cents: 1500, duration_minutes: 15, service_name_bg: "Подрязване на нокти" });
    await pool.query("update services set fixed_price_cents = 1500, fixed_duration_minutes = 15, name_bg = 'Подрязване на нокти' where id = $1", [NAIL]);
  });
});

describe("abuse controls and validation", () => {
  it("rate limiter blocks after the limit within the window", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await allowRequest(rpc, "booking", "203.0.113.9", 3, 60));
    expect(results).toEqual([true, true, true, false]);
    expect(await allowRequest(rpc, "booking", "203.0.113.10", 3, 60)).toBe(true); // other client unaffected
  });

  it("request schema validates fields and rejects the honeypot", () => {
    expect(bookingRequestSchema.safeParse(bookingInput()).success).toBe(true);
    expect(bookingRequestSchema.safeParse(bookingInput({ email: "nope" })).success).toBe(false);
    expect(bookingRequestSchema.safeParse(bookingInput({ phone: "abc" })).success).toBe(false);
    expect(bookingRequestSchema.safeParse(bookingInput({ consent: false })).success).toBe(false);
    expect(bookingRequestSchema.safeParse(bookingInput({ website: "http://spam" })).success).toBe(false);
  });
});
