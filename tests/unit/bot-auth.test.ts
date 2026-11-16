import { test } from "node:test";
import assert from "node:assert/strict";
import { isTrustedBot, requestIp } from "../../src/lib/security/bot-auth.ts";

const SECRET = "a".repeat(40);
const h = (o: Record<string, string>) => ({ get: (n: string) => o[n.toLowerCase()] ?? null });

test("trusted only with the exact secret", () => {
  assert.equal(isTrustedBot(h({ "x-bot-secret": SECRET }), SECRET), true);
  assert.equal(isTrustedBot(h({ "x-bot-secret": "b".repeat(40) }), SECRET), false);
  assert.equal(isTrustedBot(h({}), SECRET), false);
});

test("never trusted when the secret is unset or too short", () => {
  assert.equal(isTrustedBot(h({ "x-bot-secret": "short" }), "short"), false);
  assert.equal(isTrustedBot(h({ "x-bot-secret": "" }), undefined), false);
  assert.equal(isTrustedBot(h({ "x-bot-secret": "" }), ""), false);
});

test("visitor ip is honoured only for a trusted bot", () => {
  const trusted = h({ "x-bot-secret": SECRET, "x-visitor-ip": "203.0.113.7", "x-forwarded-for": "172.18.0.5" });
  assert.equal(requestIp(trusted, SECRET), "203.0.113.7");
  const spoof = h({ "x-visitor-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.9" });
  assert.equal(requestIp(spoof, SECRET), "198.51.100.9");
});

test("client ip cannot be spoofed through a forged X-Forwarded-For entry", () => {
  // The proxy appends the real peer; whatever the client put in front of it must be ignored.
  assert.equal(requestIp(h({ "x-forwarded-for": "6.6.6.6, 198.51.100.9" }), SECRET), "198.51.100.9");
  // X-Real-IP (overwritten by the proxy) wins over X-Forwarded-For.
  assert.equal(requestIp(h({ "x-real-ip": "198.51.100.9", "x-forwarded-for": "6.6.6.6" }), SECRET), "198.51.100.9");
  assert.equal(requestIp(h({}), SECRET), "unknown");
});

test("client ip ignores empty or oversize header values and falls back", () => {
  const huge = "9".repeat(65);
  assert.equal(requestIp(h({ "x-real-ip": "   ", "x-forwarded-for": "6.6.6.6, 198.51.100.9" }), SECRET), "198.51.100.9");
  assert.equal(requestIp(h({ "x-real-ip": huge, "x-forwarded-for": "198.51.100.9" }), SECRET), "198.51.100.9");
  assert.equal(requestIp(h({ "x-real-ip": huge, "x-forwarded-for": huge }), SECRET), "unknown");
});
