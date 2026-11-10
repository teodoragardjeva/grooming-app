// Admin operations. Callers MUST have verified the admin session server-side first.
// Overlap/capacity validation is always enforced by the database; admins may only override min notice.
import { bookingCancelledEmail, bookingRescheduledEmail } from "../email/templates.ts";
import { generateToken, hashToken } from "../security/tokens.ts";
import { toBookingError, type BookingError } from "./errors.ts";
import { loadEmailView } from "./email-view.ts";
import { resolveResource, type BookingDeps } from "./deps.ts";
import { sendConfirmed } from "./public.ts";

export type EmailOutcome = "sent" | "failed" | "none";

export interface AdminCreateInput {
  serviceId: string;
  variantId: string | null;
  startAt: string; // ISO with offset
  name: string;
  phone: string | null;
  email: string | null;
  dogName: string | null;
  notes: string | null;
  adminNotes: string | null;
  overrideMinNotice: boolean;
  sendEmail: boolean;
  locale: "bg" | "en";
}

export async function adminCreateAppointment(deps: BookingDeps, actor: string, i: AdminCreateInput) {
  const res = await deps.rpc<Record<string, unknown>>("create_appointment", {
    p_resource_id: await resolveResource(deps),
    p_service_id: i.serviceId,
    p_variant_id: i.variantId,
    p_start_at: i.startAt,
    p_customer_name: i.name,
    p_customer_phone: i.phone,
    p_customer_email: i.email,
    p_dog_name: i.dogName,
    p_notes: i.notes,
    p_source: "admin",
    p_confirmation_token_hash: null,
    p_override_min_notice: i.overrideMinNotice,
    p_now: deps.now().toISOString(),
    p_actor: actor,
    p_locale: i.locale,
    p_admin_notes: i.adminNotes,
  });
  if (!res.ok) return { ok: false as const, error: toBookingError(res.error) };
  const id = String(res.appointment_id);
  let email: EmailOutcome = "none";
  if (i.sendEmail && i.email) {
    const raw = generateToken();
    const issued = await deps.rpc<Record<string, unknown>>("issue_cancellation_token", {
      p_appointment_id: id,
      p_hash: hashToken(raw, deps.tokenSecret),
      p_now: deps.now().toISOString(),
    });
    email = issued.ok && (await sendConfirmed(deps, id, raw)) ? "sent" : "failed";
  }
  return {
    ok: true as const,
    appointmentId: id,
    startAt: String(res.start_at),
    endAt: String(res.end_at),
    allocStart: String(res.alloc_start),
    allocEnd: String(res.alloc_end),
    email,
  };
}

export async function adminCancelAppointment(
  deps: BookingDeps, actor: string, appointmentId: string, reason: string | null, notify: boolean,
): Promise<{ ok: true; freedStart: string | null; freedEnd: string | null; email: EmailOutcome } | { ok: false; error: BookingError }> {
  const res = await deps.rpc<Record<string, unknown>>("admin_cancel_appointment", {
    p_appointment_id: appointmentId,
    p_reason: reason,
    p_actor: actor,
    p_now: deps.now().toISOString(),
  });
  if (!res.ok) return { ok: false, error: toBookingError(res.error) };
  let email: EmailOutcome = "none";
  if (notify) {
    const view = await loadEmailView(deps, appointmentId);
    if (view?.to) {
      const m = await deps.mailer.send({
        to: view.to, kind: "booking_cancelled", appointmentId,
        idempotencyKey: `booking_cancelled:${appointmentId}`,
        content: bookingCancelledEmail({ locale: view.locale, studio: view.studio, booking: view.booking, reason: view.reason }),
      });
      email = m.ok ? "sent" : "failed"; // never undoes the cancellation
    }
  }
  return { ok: true, freedStart: (res.freed_start as string | null) ?? null, freedEnd: (res.freed_end as string | null) ?? null, email };
}

export async function adminRescheduleAppointment(
  deps: BookingDeps, actor: string, appointmentId: string, newStart: string, overrideMinNotice: boolean, notify: boolean,
): Promise<{ ok: true; startAt: string; endAt: string; email: EmailOutcome } | { ok: false; error: BookingError }> {
  const res = await deps.rpc<Record<string, unknown>>("admin_reschedule_appointment", {
    p_appointment_id: appointmentId,
    p_new_start: newStart,
    p_override_min_notice: overrideMinNotice,
    p_actor: actor,
    p_now: deps.now().toISOString(),
  });
  if (!res.ok) return { ok: false, error: toBookingError(res.error) };
  let email: EmailOutcome = "none";
  if (notify) {
    const view = await loadEmailView(deps, appointmentId);
    if (view?.to) {
      const m = await deps.mailer.send({
        to: view.to, kind: "booking_rescheduled", appointmentId,
        idempotencyKey: `booking_rescheduled:${appointmentId}:${new Date(newStart).getTime()}`,
        content: bookingRescheduledEmail({ locale: view.locale, studio: view.studio, booking: view.booking }),
      });
      email = m.ok ? "sent" : "failed";
    }
  }
  return { ok: true, startAt: String(res.start_at), endAt: String(res.end_at), email };
}

export async function adminSetStatus(deps: BookingDeps, actor: string, appointmentId: string, status: "completed" | "no_show") {
  const res = await deps.rpc<Record<string, unknown>>("admin_set_appointment_status", {
    p_appointment_id: appointmentId, p_status: status, p_actor: actor, p_now: deps.now().toISOString(),
  });
  return res.ok ? { ok: true as const } : { ok: false as const, error: String(res.error) };
}
