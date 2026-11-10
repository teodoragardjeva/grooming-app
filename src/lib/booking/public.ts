// Public customer lifecycle: request (hold + email), confirm, self-cancel. All mutations are DB RPCs;
// email failures never roll back a completed confirmation/cancellation.
import {
  bookingCancelledEmail,
  bookingConfirmedEmail,
  confirmationRequestEmail,
} from "../email/templates.ts";
import { generateToken, hashToken } from "../security/tokens.ts";
import { toBookingError, type BookingError } from "./errors.ts";
import { loadEmailView } from "./email-view.ts";
import { localizedUrl, resolveResource, type BookingDeps } from "./deps.ts";
import type { BookingRequest } from "./schemas.ts";

export type CreateResult =
  | { ok: true; startAt: string; endAt: string; durationMinutes: number; priceCents: number; currency: string; holdExpiresAt: string }
  | { ok: false; error: BookingError };

export async function createPublicBooking(deps: BookingDeps, input: BookingRequest): Promise<CreateResult> {
  const token = generateToken();
  const hash = hashToken(token, deps.tokenSecret);
  const resource = await resolveResource(deps);
  const res = await deps.rpc<Record<string, unknown>>("create_appointment", {
    p_resource_id: resource,
    p_service_id: input.serviceId,
    p_variant_id: input.variantId ?? null,
    p_start_at: input.startAt,
    p_customer_name: input.name,
    p_customer_phone: input.phone,
    p_customer_email: input.email,
    p_dog_name: input.dogName ?? null,
    p_notes: input.notes ?? null,
    p_source: "public",
    p_confirmation_token_hash: hash,
    p_now: deps.now().toISOString(),
    p_locale: input.locale,
  });
  if (!res.ok) return { ok: false, error: toBookingError(res.error) };

  const appointmentId = String(res.appointment_id);
  const view = await loadEmailView(deps, appointmentId);
  const mail = view?.to
    ? await deps.mailer.send({
        to: view.to,
        kind: "confirmation_request",
        appointmentId,
        idempotencyKey: `confirmation_request:${appointmentId}`,
        content: confirmationRequestEmail({
          locale: view.locale,
          studio: view.studio,
          booking: view.booking,
          ttlMinutes: view.ttlMinutes,
          confirmUrl: `${localizedUrl(deps.siteUrl, view.locale, "/booking/confirm")}?token=${token}`,
        }),
      })
    : { ok: false, error: "no_recipient" };

  if (!mail.ok) {
    // Safe failure path: free the hold; the customer can simply submit again (no duplicate allocation).
    await deps.rpc("release_failed_booking", { p_appointment_id: appointmentId, p_reason: "email_failed", p_now: deps.now().toISOString() });
    return { ok: false, error: "email_failed" };
  }
  return {
    ok: true,
    startAt: String(res.start_at),
    endAt: String(res.end_at),
    durationMinutes: Number(res.duration_minutes),
    priceCents: Number(res.price_cents),
    currency: String(res.currency),
    holdExpiresAt: String(res.hold_expires_at),
  };
}

export type ConfirmResult =
  | { ok: true; alreadyConfirmed: boolean; emailSent: boolean }
  | { ok: false; error: BookingError };

export async function confirmBookingByToken(deps: BookingDeps, token: string): Promise<ConfirmResult> {
  const hash = hashToken(token, deps.tokenSecret);
  const cancelToken = generateToken();
  const res = await deps.rpc<Record<string, unknown>>("confirm_booking", {
    p_token_hash: hash,
    p_cancel_token_hash: hashToken(cancelToken, deps.tokenSecret),
    p_now: deps.now().toISOString(),
  });
  if (!res.ok) return { ok: false, error: toBookingError(res.error) };
  const appointmentId = String(res.appointment_id);
  const already = res.already_confirmed === true;

  // Repeat clicks are idempotent. If the first final-confirmation email never went out, retry it with a fresh cancel token.
  if (already && (await deps.mailer.wasSent(appointmentId, "booking_confirmed"))) {
    return { ok: true, alreadyConfirmed: true, emailSent: true };
  }
  let cancelRaw = cancelToken;
  if (already) {
    cancelRaw = generateToken();
    const issued = await deps.rpc<Record<string, unknown>>("issue_cancellation_token", {
      p_appointment_id: appointmentId,
      p_hash: hashToken(cancelRaw, deps.tokenSecret),
      p_now: deps.now().toISOString(),
    });
    if (!issued.ok) return { ok: true, alreadyConfirmed: true, emailSent: false };
  }
  const emailSent = await sendConfirmed(deps, appointmentId, cancelRaw);
  return { ok: true, alreadyConfirmed: already, emailSent };
}

export async function sendConfirmed(deps: BookingDeps, appointmentId: string, cancelTokenRaw: string): Promise<boolean> {
  const view = await loadEmailView(deps, appointmentId);
  if (!view?.to) return false;
  const mail = await deps.mailer.send({
    to: view.to,
    kind: "booking_confirmed",
    appointmentId,
    idempotencyKey: `booking_confirmed:${appointmentId}:${cancelTokenRaw.slice(0, 8)}`,
    content: bookingConfirmedEmail({
      locale: view.locale,
      studio: view.studio,
      booking: view.booking,
      cancelUrl: `${localizedUrl(deps.siteUrl, view.locale, "/booking/cancel")}?token=${cancelTokenRaw}`,
    }),
  });
  return mail.ok;
}

export type CancelResult =
  | { ok: true; alreadyCancelled: boolean; emailSent: boolean }
  | { ok: false; error: BookingError; deadline?: string };

export async function cancelBookingByToken(deps: BookingDeps, token: string): Promise<CancelResult> {
  const res = await deps.rpc<Record<string, unknown>>("cancel_by_token", {
    p_token_hash: hashToken(token, deps.tokenSecret),
    p_now: deps.now().toISOString(),
  });
  if (!res.ok) return { ok: false, error: toBookingError(res.error), deadline: res.deadline ? String(res.deadline) : undefined };
  const appointmentId = String(res.appointment_id);
  if (res.already_cancelled === true) return { ok: true, alreadyCancelled: true, emailSent: true };

  const view = await loadEmailView(deps, appointmentId);
  let emailSent = false;
  if (view?.to) {
    const mail = await deps.mailer.send({
      to: view.to,
      kind: "booking_cancelled",
      appointmentId,
      idempotencyKey: `booking_cancelled:${appointmentId}`,
      content: bookingCancelledEmail({ locale: view.locale, studio: view.studio, booking: view.booking, reason: null }),
    });
    emailSent = mail.ok; // a failed email never undoes the cancellation
  }
  return { ok: true, alreadyCancelled: false, emailSent };
}

export interface TokenSummary {
  ok: true;
  status: string;
  tokenUsed: boolean;
  tokenExpired: boolean;
  serviceName: { bg: string; en: string | null };
  variantLabel: { bg: string | null; en: string | null };
  startAt: string;
  endAt: string;
  durationMinutes: number;
  priceCents: number;
  currency: string;
  customerName: string;
  dogName: string | null;
  cancelDeadline: string;
  holdExpiresAt: string | null;
}

export async function tokenSummary(
  deps: BookingDeps,
  kind: "confirm" | "cancel",
  token: string,
): Promise<TokenSummary | { ok: false; error: BookingError }> {
  const r = await deps.rpc<Record<string, unknown>>("booking_summary_by_token", {
    p_kind: kind,
    p_token_hash: hashToken(token, deps.tokenSecret),
    p_now: deps.now().toISOString(),
  });
  if (!r.ok) return { ok: false, error: toBookingError(r.error) };
  return {
    ok: true,
    status: String(r.status),
    tokenUsed: r.token_used === true,
    tokenExpired: r.token_expired === true,
    serviceName: { bg: String(r.service_name_bg), en: (r.service_name_en as string | null) ?? null },
    variantLabel: { bg: (r.variant_label_bg as string | null) ?? null, en: (r.variant_label_en as string | null) ?? null },
    startAt: String(r.start_at),
    endAt: String(r.end_at),
    durationMinutes: Number(r.duration_minutes),
    priceCents: Number(r.price_cents),
    currency: String(r.currency),
    customerName: String(r.customer_name),
    dogName: (r.dog_name as string | null) ?? null,
    cancelDeadline: String(r.cancel_deadline),
    holdExpiresAt: (r.hold_expires_at as string | null) ?? null,
  };
}
