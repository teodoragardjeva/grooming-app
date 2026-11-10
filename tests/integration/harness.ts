// Test harness: a thin pg adapter that calls the REAL database functions, plus a recording mailer.
import pg from "pg";
import type { BookingDeps, Mailer, OutgoingEmail, Rpc } from "../../src/lib/booking/deps.ts";

export const R1 = "00000000-0000-4000-8000-000000000001";
export const NAIL = "00000000-0000-4000-8000-0000000000a1";
export const FULL = "00000000-0000-4000-8000-0000000000a2";
export const TOKEN_SECRET = "test-secret-test-secret-test-secret";

export const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 20 });

export const rpc: Rpc = async <T = unknown>(fn: string, args: Record<string, unknown> = {}) => {
  const keys = Object.keys(args);
  const named = keys.map((k, i) => `${k} => $${i + 1}`).join(", ");
  const { rows } = await pool.query(`select public.${fn}(${named}) as r`, keys.map((k) => args[k]));
  return rows[0].r as T;
};

export class RecordingMailer implements Mailer {
  sent: OutgoingEmail[] = [];
  failNext = 0;
  failAll = false;
  async send(m: OutgoingEmail) {
    if (this.failAll || this.failNext > 0) {
      if (this.failNext > 0) this.failNext--;
      return { ok: false, error: "provider_error" };
    }
    this.sent.push(m);
    return { ok: true };
  }
  async wasSent(appointmentId: string, kind: string) {
    return this.sent.some((m) => m.appointmentId === appointmentId && m.kind === kind);
  }
  last(kind: string) {
    return [...this.sent].reverse().find((m) => m.kind === kind);
  }
}

/** Monday 2026-11-30 10:00 Europe/Sofia (UTC+2). */
export const NOW = new Date("2026-11-30T08:00:00Z");
/** Wednesday 2026-12-02: a normal working day (09:00-19:00). */
export const D = "2026-12-02";

export function makeDeps(now: Date = NOW, mailer = new RecordingMailer()): BookingDeps & { mailer: RecordingMailer } {
  return { rpc, mailer, now: () => now, tokenSecret: TOKEN_SECRET, siteUrl: "https://example.test", resourceId: R1 };
}

export async function resetDynamic() {
  await pool.query(`truncate appointment_allocations, confirmation_tokens, cancellation_tokens, appointments,
    customers, blocked_intervals, working_hour_overrides, notification_logs, rate_limits restart identity cascade`);
}

export function tokenFromUrl(email: OutgoingEmail | undefined): string {
  const m = email?.content.text.match(/token=([A-Za-z0-9_-]+)/);
  if (!m) throw new Error("no token link in email");
  return m[1]!;
}

export const bookingInput = (over: Record<string, unknown> = {}) => ({
  serviceId: NAIL,
  variantId: null,
  startAt: `${D}T12:00:00+02:00`,
  name: "Мария Иванова",
  phone: "+359 88 000 0000",
  email: "maria@example.com",
  dogName: "Рекс",
  notes: undefined,
  consent: true as const,
  locale: "bg" as const,
  ...over,
});
