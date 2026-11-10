import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");

function token(name: string): string {
  const m = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token ${name} not found in globals.css`);
  return m[1]!;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(fg: string, bg: string): number {
  const [a, b] = [luminance(token(fg)), luminance(token(bg))];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// [foreground, background]: pairs actually used by the components (WCAG AA normal text = 4.5).
const PAIRS: ReadonlyArray<[string, string]> = [
  ["ink-900", "parchment-50"],
  ["ink-900", "parchment-100"],
  ["burgundy-700", "parchment-50"],
  ["burgundy-700", "parchment-100"],
  ["gold-700", "parchment-50"],
  ["gold-700", "parchment-100"],
  ["parchment-50", "burgundy-900"],
  ["parchment-100", "burgundy-900"],
  ["gold-400", "burgundy-900"],
  ["burgundy-900", "gold-400"], // gold CTA button
  ["parchment-50", "burgundy-700"],
  ["parchment-100", "burgundy-700"],
  ["gold-400", "burgundy-700"],
  ["heading", "parchment-50"],
  ["parchment-50", "burgundy-800"],
  ["ink-900", "parchment-200"],
  ["heading", "parchment-100"],
  ["cream-50", "burgundy-900"],
  ["gold-300", "burgundy-900"],
  ["gold-100", "burgundy-900"],
  ["mist", "burgundy-900"],
];

describe("design token contrast (WCAG AA, 4.5:1)", () => {
  for (const [fg, bg] of PAIRS) {
    it(`${fg} on ${bg}`, () => {
      expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
