import { test } from "node:test";
import assert from "node:assert/strict";
import { generateToken, hashToken, safeEqualHex } from "../../src/lib/security/tokens.ts";
import { bookingConfirmedEmail, confirmationRequestEmail, formatMoney, formatWhen } from "../../src/lib/email/templates.ts";

const SECRET = "test-secret-0123456789";
const studio = { name: "Магически Лапички", phone: "+359 00 000 0000", email: "example@example.com" };
const booking = {
  serviceName: "Пълна груминг грижа", variantLabel: "Средно куче", startAt: new Date("2026-12-02T10:00:00Z"),
  durationMinutes: 90, priceCents: 7000, currency: "EUR", customerName: "Мария", dogName: "Рекс",
};

test("tokens are unique, long and URL-safe", () => {
  const a = generateToken(), b = generateToken();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
});
test("hash is deterministic, secret-dependent and not the raw token", () => {
  const t = generateToken();
  assert.equal(hashToken(t, SECRET), hashToken(t, SECRET));
  assert.notEqual(hashToken(t, SECRET), hashToken(t, SECRET + "x"));
  assert.ok(!hashToken(t, SECRET).includes(t));
  assert.ok(safeEqualHex(hashToken(t, SECRET), hashToken(t, SECRET)));
  assert.throws(() => hashToken(t, "short"));
});
test("money is formatted in euro for both locales", () => {
  assert.match(formatMoney(7000, "EUR", "bg"), /70,00\s?€/);
  assert.match(formatMoney(7000, "EUR", "en"), /€70\.00/);
});
test("times are shown in Europe/Sofia (10:00Z = 12:00 local in winter)", () => {
  assert.match(formatWhen(new Date("2026-12-02T10:00:00Z"), "en"), /12:00/);
  assert.match(formatWhen(new Date("2026-07-01T10:00:00Z"), "en"), /13:00/);
});
test("confirmation email (bg) has link, 10 minutes, on-site payment and escapes HTML", () => {
  const e = confirmationRequestEmail({ locale: "bg", studio, booking: { ...booking, customerName: "<b>X</b>" }, confirmUrl: "https://example.com/confirm?t=abc", ttlMinutes: 10 });
  assert.match(e.text, /10 минути/);
  assert.match(e.text, /Плащане на място в студиото/);
  assert.match(e.html, /https:\/\/example\.com\/confirm\?t=abc/);
  assert.ok(!e.html.includes("<b>X</b>"));
  assert.match(e.text, /70,00\s?€/);
});
test("confirmed email (en) includes cancel link and studio contact", () => {
  const e = bookingConfirmedEmail({ locale: "en", studio, booking, cancelUrl: "https://example.com/cancel?t=zzz" });
  assert.match(e.subject, /confirmed/);
  assert.match(e.text, /https:\/\/example\.com\/cancel\?t=zzz/);
  assert.match(e.text, /example@example\.com/);
  assert.match(e.text, /Payment at the studio/);
});
