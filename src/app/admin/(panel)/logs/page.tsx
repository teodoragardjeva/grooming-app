import { requireAdmin } from "@/lib/admin/auth";
import { fmtDateTime } from "@/lib/admin/format";
import { S } from "@/lib/admin/strings";

export default async function LogsPage() {
  const { db } = await requireAdmin();
  const [n, a] = await Promise.all([
    db.from("notification_logs").select("id,kind,recipient,status,error,created_at").order("created_at", { ascending: false }).limit(50),
    db.from("audit_logs").select("id,table_name,action,created_at").order("created_at", { ascending: false }).limit(50),
  ]);
  const th = "px-2 py-1 text-left";
  return (
    <div className="space-y-10">
      <h1 className="text-3xl text-heading">{S.logs.title}</h1>
      <section aria-labelledby="nl"><h2 id="nl" className="text-2xl text-heading">{S.logs.notifications}</h2>
        <div className="mt-2 overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className={th}>{S.logs.when}</th><th className={th}>{S.logs.kind}</th><th className={th}>{S.logs.recipient}</th><th className={th}>{S.logs.status}</th><th className={th}>{S.logs.error}</th></tr></thead>
          <tbody>{(n.data ?? []).map((r) => <tr key={r.id} className="border-t"><td className={th}>{fmtDateTime(r.created_at)}</td><td className={th}>{r.kind}</td><td className={th}>{r.recipient}</td><td className={th}>{r.status}</td><td className={th}>{r.error}</td></tr>)}</tbody></table></div></section>
      <section aria-labelledby="al"><h2 id="al" className="text-2xl text-heading">{S.logs.audit}</h2>
        <div className="mt-2 overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className={th}>{S.logs.when}</th><th className={th}>{S.logs.table}</th><th className={th}>{S.logs.action}</th></tr></thead>
          <tbody>{(a.data ?? []).map((r) => <tr key={r.id} className="border-t"><td className={th}>{fmtDateTime(r.created_at)}</td><td className={th}>{r.table_name}</td><td className={th}>{r.action}</td></tr>)}</tbody></table></div></section>
    </div>
  );
}
