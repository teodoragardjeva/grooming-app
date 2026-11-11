// Environment access. Server-only values are read lazily so builds/tests do not need them.
import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  TOKEN_HASH_SECRET: z.string().min(16, "TOKEN_HASH_SECRET must be at least 16 characters"),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),
  CRON_SECRET: z.string().min(16).optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  // Chatbot (n8n). Both optional: without them the chat endpoint answers "not_configured".
  // Empty strings (compose passes unset variables as "") count as "not set".
  BOT_SECRET: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(32).optional()),
  N8N_CHAT_WEBHOOK_URL: z.preprocess((v) => (v === "" ? undefined : v), z.url().optional()),
});

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** PostgreSQL connection string, or null when the database is not configured. */
export function databaseUrl(): string | null {
  return process.env.DATABASE_URL || null;
}

/** Directory for uploaded images (gallery etc.). Mount a persistent volume here in production. */
export function mediaDir(): string {
  return process.env.MEDIA_DIR || "./data/media";
}

export type ServerEnv = z.infer<typeof serverSchema>;

export function serverEnv(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Missing/invalid server environment variables: ${missing}`);
  }
  return parsed.data;
}
