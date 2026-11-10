import { describe, expect, it } from "vitest";
import { detectImage } from "../../src/lib/admin/image-type.ts";
import { cents, int } from "../../src/lib/admin/parse.ts";
import { isActivePromotion } from "../../src/lib/content/active-promotions.ts";
import { formatPrice, paragraphs, pick, servicePriceCents } from "../../src/lib/content/locale.ts";
import { availabilityQuerySchema, bookingRequestSchema } from "../../src/lib/booking/schemas.ts";

const base = {
  serviceId: "00000000-0000-4000-8000-0000000000a1", startAt: "2026-12-02T09:00:00+02:00", name: "Мария Иванова",
  phone: "+359 88 123 4567", email: "maria@example.com", consent: true, locale: "bg",
};

describe("booking request schema", () => {
  it("accepts a valid request", () => expect(bookingRequestSchema.safeParse(base).success).toBe(true));
  it("requires consent", () => expect(bookingRequestSchema.safeParse({ ...base, consent: false }).success).toBe(false));
  it("rejects a filled honeypot", () => expect(bookingRequestSchema.safeParse({ ...base, website: "http://spam" }).success).toBe(false));
  it("rejects bad email and phone with error codes", () => {
    const r = bookingRequestSchema.safeParse({ ...base, email: "nope", phone: "abc" });
    expect(r.success).toBe(false);
    const msgs = r.success ? [] : r.error.issues.map((i) => i.message);
    expect(msgs).toContain("email_invalid");
    expect(msgs).toContain("phone_invalid");
  });
  it("rejects unknown locale", () => expect(bookingRequestSchema.safeParse({ ...base, locale: "de" }).success).toBe(false));
});

describe("availability query", () => {
  it("validates date shape", () => {
    expect(availabilityQuerySchema.safeParse({ service: base.serviceId, date: "2026-12-02" }).success).toBe(true);
    expect(availabilityQuerySchema.safeParse({ service: base.serviceId, date: "02/12/2026" }).success).toBe(false);
  });
});

describe("image magic bytes", () => {
  const pad = (b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
  it("detects jpeg/png/webp", () => {
    expect(detectImage(pad([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(detectImage(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.mime).toBe("image/png");
    expect(detectImage(pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))?.mime).toBe("image/webp");
  });
  it("rejects svg/html/executables regardless of extension", () => {
    expect(detectImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
    expect(detectImage(new TextEncoder().encode("<html><script>alert(1)</script></html>"))).toBeNull();
  });
});

describe("admin form parsing", () => {
  const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
  it("converts euros to integer cents", () => {
    expect(cents(fd({ p: "12,50" }), "p")).toBe(1250);
    expect(cents(fd({ p: "70" }), "p")).toBe(7000);
    expect(cents(fd({ p: "0.1" }), "p")).toBe(10);
    expect(cents(fd({ p: "-5" }), "p")).toBeNaN();
    expect(cents(fd({ p: "" }), "p")).toBeNull();
  });
  it("parses integers strictly", () => {
    expect(int(fd({ n: "15" }), "n")).toBe(15);
    expect(int(fd({ n: "1.5" }), "n")).toBeNaN();
  });
});

describe("content helpers", () => {
  it("falls back to Bulgarian when English is empty", () => {
    expect(pick("en", "Здравей", "")).toBe("Здравей");
    expect(pick("en", "Здравей", "Hello")).toBe("Hello");
    expect(pick("bg", "Здравей", "Hello")).toBe("Здравей");
  });
  it("splits paragraphs on blank lines", () => expect(paragraphs("a\n\n b \n\n\nc")).toEqual(["a", "b", "c"]));
  it("shows 'from' price for size-based services", () => {
    const s = { duration_mode: "size_based", fixed_price_cents: null, service_variants: [{ price_cents: 7000 }, { price_cents: 5000 }] };
    expect(servicePriceCents(s)).toEqual({ cents: 5000, isFrom: true });
  });
  it("formats EUR for both locales", () => {
    expect(formatPrice(5000, "EUR", "en")).toContain("50");
    expect(formatPrice(5000, "EUR", "bg")).toMatch(/€|EUR/);
  });
  it("promotion window is inclusive of open ends", () => {
    const now = new Date("2026-12-01T10:00:00Z");
    expect(isActivePromotion({ starts_at: null, ends_at: null }, now)).toBe(true);
    expect(isActivePromotion({ starts_at: "2026-12-02T00:00:00Z", ends_at: null }, now)).toBe(false);
    expect(isActivePromotion({ starts_at: null, ends_at: "2026-11-30T00:00:00Z" }, now)).toBe(false);
  });
});
