// Production wiring: PostgreSQL functions + Resend. SERVER ONLY.
import "server-only";
import { serverEnv, siteUrl } from "../env.ts";
import { createMailer } from "../email/send.ts";
import { getDb } from "../db/index.ts";
import type { BookingDeps, Rpc } from "./deps.ts";

export function createRpc(): Rpc {
  return getDb().rpc;
}

export function createBookingDeps(): BookingDeps {
  const env = serverEnv();
  const db = getDb();
  return {
    rpc: db.rpc,
    mailer: createMailer({ db, apiKey: env.RESEND_API_KEY, from: env.RESEND_FROM }),
    now: () => new Date(),
    tokenSecret: env.TOKEN_HASH_SECRET,
    siteUrl: siteUrl(),
  };
}
