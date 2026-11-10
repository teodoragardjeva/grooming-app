// Single-use confirmation/cancellation tokens. The raw token only ever travels in the email link;
// the database stores an HMAC-SHA256 hash (never the raw value).
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** 256-bit URL-safe random token. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Hex HMAC-SHA256 of the token with a server-side secret (TOKEN_HASH_SECRET). */
export function hashToken(token: string, secret: string): string {
  if (!secret || secret.length < 16) throw new Error("TOKEN_HASH_SECRET must be set (>= 16 chars)");
  return createHmac("sha256", secret).update(token).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
