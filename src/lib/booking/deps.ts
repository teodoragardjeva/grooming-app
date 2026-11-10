// Dependencies injected into the booking use-cases: production wires PostgreSQL functions + Resend;
// integration tests wire a real local PostgreSQL and a recording mailer.
import type { EmailContent } from "../email/templates.ts";
import type { Rpc } from "../security/rate-limit.ts";

export type { Rpc };

export interface OutgoingEmail {
  to: string;
  content: EmailContent;
  kind: string;
  appointmentId: string;
  idempotencyKey?: string;
}
export interface MailResult {
  ok: boolean;
  error?: string;
}
export interface Mailer {
  send(m: OutgoingEmail): Promise<MailResult>;
  wasSent(appointmentId: string, kind: string): Promise<boolean>;
}

export interface BookingDeps {
  rpc: Rpc;
  mailer: Mailer;
  now: () => Date;
  tokenSecret: string;
  siteUrl: string;
  /** Optional: skip the get_default_resource lookup. */
  resourceId?: string;
}

export function localizedUrl(siteUrl: string, locale: "bg" | "en", path: string): string {
  return `${siteUrl.replace(/\/$/, "")}${locale === "en" ? "/en" : ""}${path}`;
}

export async function resolveResource(deps: BookingDeps): Promise<string> {
  if (deps.resourceId) return deps.resourceId;
  const id = await deps.rpc<string | null>("get_default_resource");
  if (!id) throw new Error("No default booking resource configured");
  return id;
}
