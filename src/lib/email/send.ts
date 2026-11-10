// Resend mailer with notification logging. Failures are logged and returned, never thrown.
import { Resend } from "resend";
import type { Db } from "../db/client.ts";
import type { Mailer, OutgoingEmail, MailResult } from "../booking/deps.ts";

export function createMailer(opts: { db: Db; apiKey?: string; from?: string }): Mailer {
  const { db } = opts;
  const resend = opts.apiKey ? new Resend(opts.apiKey) : null;

  async function log(row: Record<string, unknown>): Promise<void> {
    try {
      await db.from("notification_logs").insert(row);
    } catch {
      /* logging must never break a booking */
    }
  }

  return {
    async send(m: OutgoingEmail): Promise<MailResult> {
      if (m.idempotencyKey) {
        const { data } = await db
          .from("notification_logs")
          .select("id")
          .eq("idempotency_key", m.idempotencyKey)
          .eq("status", "sent")
          .maybeSingle();
        if (data) return { ok: true };
      }
      if (!resend || !opts.from) {
        await log({ appointment_id: m.appointmentId, kind: m.kind, recipient: m.to, status: "failed", error: "email_not_configured" });
        return { ok: false, error: "email_not_configured" };
      }
      try {
        const { data, error } = await resend.emails.send(
          { from: opts.from, to: m.to, subject: m.content.subject, html: m.content.html, text: m.content.text },
          m.idempotencyKey ? { idempotencyKey: m.idempotencyKey } : undefined,
        );
        if (error) {
          await log({ appointment_id: m.appointmentId, kind: m.kind, recipient: m.to, status: "failed", error: error.message?.slice(0, 500) });
          return { ok: false, error: "provider_error" };
        }
        await log({
          appointment_id: m.appointmentId, kind: m.kind, recipient: m.to, status: "sent",
          provider_id: data?.id ?? null, idempotency_key: m.idempotencyKey ?? null,
        });
        return { ok: true };
      } catch (err) {
        await log({ appointment_id: m.appointmentId, kind: m.kind, recipient: m.to, status: "failed", error: String(err).slice(0, 500) });
        return { ok: false, error: "provider_error" };
      }
    },

    async wasSent(appointmentId: string, kind: string): Promise<boolean> {
      const { count } = await db
        .from("notification_logs")
        .select("id", { count: "exact", head: true })
        .eq("appointment_id", appointmentId)
        .eq("kind", kind)
        .eq("status", "sent");
      return (count ?? 0) > 0;
    },
  };
}
