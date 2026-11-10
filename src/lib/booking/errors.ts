// Error codes returned to clients (never raw DB/provider errors).
export const BOOKING_ERRORS = [
  "invalid_input", "service_not_found", "variant_required", "variant_invalid", "too_soon", "too_far",
  "outside_hours", "blocked", "slot_taken", "resource_not_found", "email_failed", "rate_limited",
  "captcha_failed", "pending_exists", "invalid_token", "expired", "too_late", "not_cancellable", "internal",
] as const;
export type BookingError = (typeof BOOKING_ERRORS)[number];

export function toBookingError(code: unknown): BookingError {
  return (BOOKING_ERRORS as readonly string[]).includes(code as string) ? (code as BookingError) : "internal";
}
