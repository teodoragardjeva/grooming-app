"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { back } from "@/lib/admin/flash";
import { S } from "@/lib/admin/strings";
import { createRpc } from "@/lib/booking/runtime";
import { isValidDateString } from "@/lib/time/dates";
import { localDateTimeToUtc } from "@/lib/time/zone";

type Fields = Record<string, string>;
type Kind = "weekly" | "override" | "block";
const HERE = "/admin/schedule";
const T = /^\d{2}:\d{2}$/;

function toFields(fd: FormData): Fields {
  const out: Fields = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && !k.startsWith("$ACTION")) out[k] = v;
  return out;
}

interface Conflict { appointment_id: string; start_at: string; customer_name: string }

async function apply(kind: Kind, f: Fields, confirm: boolean) {
  const { userId } = await requireAdmin();
  let rpc;
  try { rpc = createRpc(); } catch (e) { back(HERE, "err", `${S.err.not_configured} ${e instanceof Error ? e.message : ""}`.trim()); }
  const resource = await rpc<string>("get_default_resource");

  let res: Record<string, unknown>;
  if (kind === "weekly") {
    const hours: { weekday: number; start: string; end: string }[] = [];
    for (let d = 1; d <= 7; d++) {
      for (let i = 0; i < 3; i++) {
        const s = f[`w${d}_${i}_start`], e = f[`w${d}_${i}_end`];
        if (!s && !e) continue;
        if (!T.test(s ?? "") || !T.test(e ?? "") || e! <= s!) back(HERE, "err", S.sched.invalid);
        hours.push({ weekday: d, start: s!, end: e! });
      }
    }
    // overlapping shifts on one day are invalid
    for (let d = 1; d <= 7; d++) {
      const day = hours.filter((h) => h.weekday === d).sort((a, b) => a.start.localeCompare(b.start));
      for (let i = 1; i < day.length; i++) if (day[i].start < day[i - 1].end) back(HERE, "err", S.sched.invalid);
    }
    res = await rpc("admin_replace_weekly_hours", { p_resource: resource, p_hours: hours, p_confirm_conflicts: confirm, p_actor: userId });
  } else if (kind === "override") {
    const closed = f.mode !== "special";
    if (!isValidDateString(f.from ?? "") || !isValidDateString(f.to || f.from)) back(HERE, "err", S.sched.invalid);
    if (!closed && (!T.test(f.start ?? "") || !T.test(f.end ?? ""))) back(HERE, "err", S.sched.invalid);
    res = await rpc("admin_set_override_range", {
      p_resource: resource, p_from: f.from, p_to: f.to || f.from, p_closed: closed,
      p_start: closed ? null : f.start, p_end: closed ? null : f.end, p_note: f.note ?? null, p_confirm_conflicts: confirm, p_actor: userId,
    });
  } else {
    const ok = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v);
    if (!ok(f.start) || !ok(f.end)) back(HERE, "err", S.sched.invalid);
    const [sd, st] = f.start.split("T"), [ed, et] = f.end.split("T");
    res = await rpc("admin_add_block", {
      p_resource: resource, p_start: localDateTimeToUtc(sd, st).toISOString(), p_end: localDateTimeToUtc(ed, et).toISOString(),
      p_reason: f.reason ?? null, p_confirm_conflicts: confirm, p_actor: userId,
    });
  }

  if (res.ok === true) { revalidatePath("/admin", "layout"); back(HERE, "ok", S.sched.saved); }
  if (res.error === "conflicts") {
    // Never auto-cancel: show the affected appointments and ask for explicit confirmation.
    const list = (res.conflicts as Conflict[]).slice(0, 25).map((c) => ({ id: c.appointment_id, s: c.start_at, n: c.customer_name }));
    const payload = Buffer.from(JSON.stringify({ kind, f, list })).toString("base64url");
    redirect(`${HERE}?pending=${payload}`);
  }
  back(HERE, "err", S.sched.invalid);
}

export async function saveWeeklyAction(fd: FormData) { await apply("weekly", toFields(fd), false); }
export async function saveOverrideAction(fd: FormData) { await apply("override", toFields(fd), false); }
export async function addBlockAction(fd: FormData) { await apply("block", toFields(fd), false); }

/** Re-applies a previously conflicting change after the admin explicitly confirmed it. */
export async function confirmPendingAction(fd: FormData) {
  await requireAdmin();
  if (fd.get("confirm") !== "yes") back(HERE, "err", S.common.error);
  let parsed: { kind: Kind; f: Fields };
  try { parsed = JSON.parse(Buffer.from(String(fd.get("pending")), "base64url").toString()); } catch { back(HERE, "err", S.common.error); }
  if (!["weekly", "override", "block"].includes(parsed.kind)) back(HERE, "err", S.common.error);
  await apply(parsed.kind, parsed.f, true);
}

export async function deleteOverrideAction(fd: FormData) {
  const { db } = await requireAdmin();
  await db.from("working_hour_overrides").delete().eq("id", String(fd.get("id")));
  revalidatePath("/admin", "layout");
  back(HERE, "ok", S.sched.saved);
}

export async function deleteBlockAction(fd: FormData) {
  const { db } = await requireAdmin();
  await db.from("blocked_intervals").delete().eq("id", String(fd.get("id")));
  revalidatePath("/admin", "layout");
  back(HERE, "ok", S.sched.saved);
}
