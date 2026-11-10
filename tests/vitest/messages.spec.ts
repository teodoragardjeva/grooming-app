import { describe, expect, it } from "vitest";
import bg from "../../src/messages/bg.json";
import en from "../../src/messages/en.json";

function flatten(obj: unknown, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") Object.assign(out, flatten(v, key));
    else out[key] = String(v);
  }
  return out;
}

const fb = flatten(bg);
const fe = flatten(en);

describe("UI messages", () => {
  it("bg and en define exactly the same keys", () => {
    expect(Object.keys(fe).sort()).toEqual(Object.keys(fb).sort());
  });

  it("has no empty strings", () => {
    for (const [k, v] of [...Object.entries(fb), ...Object.entries(fe)]) {
      expect(v.trim(), k).not.toBe("");
    }
  });

  it("Bulgarian strings contain Cyrillic, not copied English", () => {
    for (const [k, v] of Object.entries(fb)) {
      if (k === "language.en") continue; // "English" is the endonym
      expect(v, k).toMatch(/[Ѐ-ӿ]/);
    }
  });

  it("never uses the lev currency abbreviation (currency is EUR)", () => {
    for (const [k, v] of [...Object.entries(fb), ...Object.entries(fe)]) {
      expect(v, k).not.toMatch(/лв\.?/i);
    }
  });

  it("contains no Harry Potter trademarks or lookalike branding (IP safety)", () => {
    const banned = /hogwarts|хогвартс|хогвартска|gryffindor|слизерин|slytherin|hufflepuff|ravenclaw|грифиндор|дъмбълдор|dumbledore|harry potter|хари потър/i;
    for (const [k, v] of [...Object.entries(fb), ...Object.entries(fe)]) {
      expect(v, k).not.toMatch(banned);
    }
  });
});
