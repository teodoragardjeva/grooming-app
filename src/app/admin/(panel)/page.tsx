import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { fmtTime } from "@/lib/admin/format";
import { S } from "@/lib/admin/strings";
import { addDays, localDateOf } from "@/lib/time/dates";
import { localDateTimeToUtc } from "@/lib/time/zone";

export default async function OverviewPage() {
  const { db } = await requireAdmin();
  const today = localDateOf(new Date());
  const a = localDateTimeToUtc(today, "00:00").toISOString();
  const b = localDateTimeToUtc(addDays(today, 1), "00:00").toISOString();
  const w = localDateTimeToUtc(addDays(today, 8), "00:00").toISOString();
  const [todayRes, pendingRes, upcomingRes] = await Promise.all([
    db.from("appointments").select("id,status,start_at,customer_name,dog_name,service_name_bg").in("status", ["pending_confirmation", "confirmed"]).gte("start_at", a).lt("start_at", b).order("start_at"),
    db.from("appointments").select("id", { count: "exact", head: true }).eq("status", "pending_confirmation").gt("hold_expires_at", new Date().toISOString()),
    db.from("appointments").select("id", { count: "exact", head: true }).eq("status", "confirmed").gte("start_at", b).lt("start_at", w),
  ]);
  const list = todayRes.data ?? [];
  return (
    <div>
      <h1 className="text-3xl text-heading">{S.overview.title}</h1>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-parchment-100 p-4"><p className="text-sm">{S.overview.today}</p><p className="text-3xl font-bold">{list.length}</p></div>
        <div className="rounded-xl bg-parchment-100 p-4"><p className="text-sm">{S.overview.pending}</p><p className="text-3xl font-bold">{pendingRes.count ?? 0}</p></div>
        <div className="rounded-xl bg-parchment-100 p-4"><p className="text-sm">{S.overview.upcoming}</p><p className="text-3xl font-bold">{upcomingRes.count ?? 0}</p></div>
      </div>
      <h2 className="mt-8 text-2xl text-heading">{S.overview.today}</h2>
      {list.length === 0 ? <p className="mt-2">{S.overview.none}</p> : (
        <ul className="mt-2 space-y-2">
          {list.map((x) => (
            <li key={x.id}><Link className="underline" href={`/admin/appointments/${x.id}`}>{fmtTime(x.start_at)} – {x.customer_name}{x.dog_name ? ` (${x.dog_name})` : ""} · {x.service_name_bg}</Link> <span className="text-sm">({S.status[x.status]})</span></li>
          ))}
        </ul>
      )}
      <p className="mt-6"><Link className="underline" href="/admin/calendar">{S.overview.openCal}</Link></p>
    </div>
  );
}
