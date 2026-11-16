import { describe, expect, it } from "vitest";
import { dmyToIso, isoToDmy, maskDmy, maskHm, validHm } from "../../src/lib/admin/date-input.ts";
import { fmtDateTime, fmtDayShort } from "../../src/lib/admin/format.ts";

describe("admin date input (dd/mm/yyyy)", () => {
  it("masks typed digits with slashes", () => {
    expect(maskDmy("1")).toBe("1");
    expect(maskDmy("161")).toBe("16/1");
    expect(maskDmy("16112026")).toBe("16/11/2026");
    expect(maskDmy("16/11/2026999")).toBe("16/11/2026");
    expect(maskDmy("ab16-11")).toBe("16/11");
  });
  it("converts dd/mm/yyyy to ISO and back", () => {
    expect(dmyToIso("02/12/2026")).toBe("2026-12-02");
    expect(isoToDmy("2026-12-02")).toBe("02/12/2026");
    expect(isoToDmy("")).toBe("");
    expect(isoToDmy(undefined)).toBe("");
  });
  it("is day-first: 12/02/2026 is 12 February, not 2 December", () => expect(dmyToIso("12/02/2026")).toBe("2026-02-12"));
  it("rejects impossible or incomplete dates", () => {
    for (const bad of ["31/02/2026", "00/01/2026", "15/13/2026", "1/1/2026", "16/11/26", "2026-11-16", ""]) expect(dmyToIso(bad)).toBeNull();
    expect(dmyToIso("29/02/2028")).toBe("2028-02-29"); // leap year
    expect(dmyToIso("29/02/2027")).toBeNull();
  });
});

describe("admin time input (24 h)", () => {
  it("masks typed digits with a colon", () => {
    expect(maskHm("9")).toBe("9");
    expect(maskHm("093")).toBe("09:3");
    expect(maskHm("0930")).toBe("09:30");
    expect(maskHm("09:3099")).toBe("09:30");
  });
  it("accepts only HH:mm 00:00-23:59", () => {
    expect(validHm("09:30")).toBe("09:30");
    expect(validHm("23:59")).toBe("23:59");
    for (const bad of ["24:00", "9:30", "09:60", "0930", "09:30 PM", ""]) expect(validHm(bad)).toBeNull();
  });
});

describe("admin display formats", () => {
  it("shows date and time as dd/mm/yyyy HH:mm in Europe/Sofia", () => {
    expect(fmtDateTime("2026-12-02T09:05:00Z")).toBe("02/12/2026 11:05"); // UTC+2 in winter
    expect(fmtDateTime("2026-07-02T09:05:00Z")).toBe("02/07/2026 12:05"); // UTC+3 in summer
  });
  it("shows the short day as weekday + dd/mm", () => expect(fmtDayShort("2026-12-02")).toMatch(/ 02\/12$/));
});
