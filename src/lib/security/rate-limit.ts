// DB-backed fixed-window rate limiting (works across serverless instances).
import { createHash } from "node:crypto";

export type Rpc = <T = unknown>(fn: string, args?: Record<string, unknown>) => Promise<T>;

export function clientIp(headers: { get(name: string): string | null }): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
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
