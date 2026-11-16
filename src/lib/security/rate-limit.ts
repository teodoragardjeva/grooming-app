// DB-backed fixed-window rate limiting (works across serverless instances).
import { createHash } from "node:crypto";

export type Rpc = <T = unknown>(fn: string, args?: Record<string, unknown>) => Promise<T>;

/**
 * The client IP as seen by our single trusted reverse proxy (Nginx Proxy Manager).
 * NPM overwrites `X-Real-IP` with the real peer address, and APPENDS the peer to any client-supplied
 * `X-Forwarded-For`. So the first X-Forwarded-For entry is attacker-controlled (rotating it would bypass every
 * rate limit, including the admin login throttle); only `X-Real-IP` or the LAST entry can be trusted.
 */
export function clientIp(headers: { get(name: string): string | null }): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real && real.length <= 64) return real;
  const last = headers.get("x-forwarded-for")?.split(",").pop()?.trim();
  if (last && last.length <= 64) return last;
  return "unknown";
}

/** Returns true when the request is allowed. Keys are hashed so raw IPs are not stored. */
export async function allowRequest(
  rpc: Rpc,
  scope: string,
  ip: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const key = `${scope}:${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`;
  return rpc<boolean>("check_rate_limit", { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
}
