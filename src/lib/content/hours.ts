// Opening hours text built from the real weekly schedule (working_hours). Pure; erasable TypeScript only.

export interface WeeklyRow {
  weekday: number; // ISO: 1 = Monday .. 7 = Sunday
  start_time: string; // "HH:mm" or "HH:mm:ss"
  end_time: string;
}

const hm = (t: string) => t.slice(0, 5);

/** One line per group of consecutive days with identical hours, e.g. "Пн–Пт: 09:00–18:00". Closed days are left out. */
export function formatWeeklyHours(rows: readonly WeeklyRow[], locale: string): string[] {
  const byDay = new Map<number, string>();
  for (let d = 1; d <= 7; d++) {
    const spans = rows
      .filter((r) => r.weekday === d)
      .map((r) => `${hm(r.start_time)}–${hm(r.end_time)}`)
      .sort();
    if (spans.length) byDay.set(d, spans.join(", "));
  }
  // 2024-01-01 is a Monday
  const dayName = (d: number) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, d)));
  const lines: string[] = [];
  let d = 1;
  while (d <= 7) {
    const spans = byDay.get(d);
    if (!spans) { d++; continue; }
    let end = d;
    while (end < 7 && byDay.get(end + 1) === spans) end++;
    const label = end === d ? dayName(d) : end === d + 1 ? `${dayName(d)}, ${dayName(end)}` : `${dayName(d)}–${dayName(end)}`;
    lines.push(`${label}: ${spans}`);
    d = end + 1;
  }
  return lines;
}
