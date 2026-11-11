// Server-to-server trust for the chatbot (n8n). n8n sends the shared BOT_SECRET in `x-bot-secret` and the
// visitor's IP in `x-visitor-ip`. A trusted caller skips Turnstile (it cannot solve a captcha) and is rate-limited
// per visitor IP instead of per n8n container. Without a valid secret nothing changes for the caller.
import { createHash, timingSafeEqual } from "node:crypto";
import { clientIp } from "./rate-limit.ts";

type Headers = { get(name: string): string | null };

const digest = (s: string) => createHash("sha256").update(s).digest();

/** True only when BOT_SECRET is configured (>= 32 chars) and the request carries exactly that secret. */
export function isTrustedBot(headers: Headers, secret: string | undefined): boolean {
  if (!secret || secret.length < 32) return false;
  const given = headers.get("x-bot-secret");
  if (!given) return false;
  return timingSafeEqual(digest(given), digest(secret));
}

/** The IP to rate-limit on: the visitor's own IP for a trusted bot, otherwise the normal client IP. */
export function requestIp(headers: Headers, secret: string | undefined): string {
  if (isTrustedBot(headers, secret)) {
    const visitor = headers.get("x-visitor-ip")?.split(",")[0]?.trim();
    if (visitor && visitor.length <= 64) return visitor;
  }
  return clientIp(headers);
}
