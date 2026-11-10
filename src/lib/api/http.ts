import { NextResponse } from "next/server";
import type { BookingError } from "../booking/errors.ts";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

const STATUS: Record<BookingError, number> = {
  invalid_input: 400, service_not_found: 404, variant_required: 400, variant_invalid: 400,
  too_soon: 409, too_far: 409, outside_hours: 409, blocked: 409, slot_taken: 409,
  resource_not_found: 404, email_failed: 502, rate_limited: 429, captcha_failed: 400, pending_exists: 409,
  invalid_token: 404, expired: 410, too_late: 409, not_cancellable: 409, internal: 500,
};

export function errorResponse(error: BookingError, extra: Record<string, unknown> = {}): NextResponse {
  return json({ ok: false, error, ...extra }, STATUS[error]);
}

/** Runs a handler; configuration/other failures become safe JSON (no internals leaked). */
export async function guarded(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api] unhandled:", msg);
    if (msg.startsWith("Missing/invalid server environment") || msg.includes("not set") || msg.includes("not configured")) {
      return json({ ok: false, error: "not_configured" }, 503);
    }
    return errorResponse("internal");
  }
}
