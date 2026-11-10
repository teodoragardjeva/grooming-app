"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { back } from "@/lib/admin/flash";
import { S } from "@/lib/admin/strings";
import { adminCancelAppointment, adminCreateAppointment, adminRescheduleAppointment, adminSetStatus } from "@/lib/booking/admin";
import { createBookingDeps } from "@/lib/booking/runtime";
import { isValidDateString } from "@/lib/time/dates";
import { localDateTimeToUtc } from "@/lib/time/zone";

const errText = (code: string) => S.err[code] ?? S.err.internal;
const opt = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const when = (date: string | null, time: string | null) => {
  if (!date || !time || !isValidDateString(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  return localDateTimeToUtc(date, time).toISOString();
};

async function deps() {
  try {
    return createBookingDeps();
  } catch {
    return null;
  }
}

const createSchema = z.object({
  service: z.string().regex(/^[0-9a-f-]{36}(\|[0-9a-f-]{36})?$/),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(30).nullable(),
  email: z.email().max(200).nullable(),
});

export async function createAppointmentAction(formData: FormData) {
  const { userId } = await requireAdmin();
  const date = opt(formData.get("date")), time = opt(formData.get("time"));
  const here = `/admin/appointments/new?date=${date ?? ""}&time=${time ?? ""}`;
  const startAt = when(date, time);
  const email = opt(formData.get("email"));
  const parsed = createSchema.safeParse({ service: formData.get("service"), name: formData.get("name"), phone: opt(formData.get("phone")), email });
  if (!startAt || !parsed.success) back(here, "err", S.appt.slotRequired);
  const d = await deps();
  if (!d) back(here, "err", S.err.not_configured);
  const [serviceId, variantId] = parsed.data.service.split("|");
  const r = await adminCreateAppointment(d, userId, {
    serviceId, variantId: variantId ?? null, startAt, name: parsed.data.name, phone: parsed.data.phone, email: parsed.data.email,
    dogName: opt(formData.get("dog")), notes: opt(formData.get("notes")), adminNotes: opt(formData.get("adminNotes")),
    overrideMinNotice: formData.get("override") === "on", sendEmail: formData.get("sendEmail") === "on", locale: "bg",
  });
  if (!r.ok) back(here, "err", errText(r.error));
  revalidatePath("/admin", "layout");
  redirect(`/admin/appointments/${r.appointmentId}?ok=${encodeURIComponent(r.email === "failed" ? `${S.appt.created} ${S.appt.emailFailed}` : S.appt.created)}`);
}

const idSchema = z.uuid();

export async function cancelAppointmentAction(formData: FormData) {
  const { userId } = await requireAdmin();
  const id = idSchema.parse(formData.get("id"));
  const here = `/admin/appointments/${id}`;
  if (formData.get("confirm") !== "yes") back(here, "err", S.common.error); // explicit two-step confirmation
  const d = await deps();
  if (!d) back(here, "err", S.err.not_configured);
  const r = await adminCancelAppointment(d, userId, id, opt(formData.get("reason")), formData.get("notify") === "on");
  if (!r.ok) back(here, "err", errText(r.error));
  revalidatePath("/admin", "layout");
  back(here, "ok", r.email === "failed" ? `${S.appt.cancelled} ${S.appt.emailFailed}` : S.appt.cancelled);
}

export async function rescheduleAppointmentAction(formData: FormData) {
  const { userId } = await requireAdmin();
  const id = idSchema.parse(formData.get("id"));
  const here = `/admin/appointments/${id}`;
  const startAt = when(opt(formData.get("date")), opt(formData.get("time")));
  if (!startAt) back(here, "err", S.appt.slotRequired);
  const d = await deps();
  if (!d) back(here, "err", S.err.not_configured);
  const r = await adminRescheduleAppointment(d, userId, id, startAt, formData.get("override") === "on", formData.get("notify") === "on");
  if (!r.ok) back(here, "err", errText(r.error));
  revalidatePath("/admin", "layout");
  back(here, "ok", r.email === "failed" ? `${S.appt.rescheduled} ${S.appt.emailFailed}` : S.appt.rescheduled);
}

export async function setStatusAction(formData: FormData) {
  const { userId } = await requireAdmin();
  const id = idSchema.parse(formData.get("id"));
  const status = z.enum(["completed", "no_show"]).parse(formData.get("status"));
  const here = `/admin/appointments/${id}`;
  const d = await deps();
  if (!d) back(here, "err", S.err.not_configured);
  const r = await adminSetStatus(d, userId, id, status);
  if (!r.ok) back(here, "err", errText(r.error));
  revalidatePath("/admin", "layout");
  back(here, "ok", S.appt.statusSaved);
}

export async function saveNotesAction(formData: FormData) {
  const { db } = await requireAdmin();
  const id = idSchema.parse(formData.get("id"));
  const { error } = await db.from("appointments").update({ admin_notes: opt(formData.get("adminNotes")) }).eq("id", id);
  back(`/admin/appointments/${id}`, error ? "err" : "ok", error ? S.common.error : S.common.saved);
}
