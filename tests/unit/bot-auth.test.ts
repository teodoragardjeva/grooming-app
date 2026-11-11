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
