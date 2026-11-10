import { describe, expect, it } from "vitest";
import { buildAlternates, localizedPath } from "../../src/lib/seo/metadata";
import { cn } from "../../src/lib/utils";

describe("localizedPath (localePrefix as-needed)", () => {
  it("Bulgarian has no prefix", () => {
    expect(localizedPath("bg", "/")).toBe("/");
    expect(localizedPath("bg", "/services")).toBe("/services");
  });
  it("English is under /en", () => {
    expect(localizedPath("en", "/")).toBe("/en");
    expect(localizedPath("en", "/services")).toBe("/en/services");
    expect(localizedPath("en", "/legal/privacy")).toBe("/en/legal/privacy");
  });
});

describe("buildAlternates", () => {
  it("emits canonical, both hreflang entries and x-default=bg", () => {
    const a = buildAlternates("en", "/about");
    expect(a.canonical).toBe("/en/about");
    expect(a.languages).toEqual({ bg: "/about", en: "/en/about", "x-default": "/about" });
  });
});

describe("cn", () => {
  it("merges conflicting tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
