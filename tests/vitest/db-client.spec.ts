import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { createDb } from "../../src/lib/db/client.ts";

function fakePool(rows: Record<string, unknown>[] = []) {
  const calls: { text: string; values: unknown[] }[] = [];
  const pool = {
    query: async (text: string, values: unknown[] = []) => {
      calls.push({ text, values });
      return { rows };
    },
  } as unknown as Pool;
  return { db: createDb(pool), calls };
}

describe("db query builder", () => {
  it("builds parameterised selects with filters, order and limit", async () => {
    const { db, calls } = fakePool([{ id: "1" }]);
    const res = await db.from("appointments").select("id,status").in("status", ["a", "b"]).gte("start_at", "2026-01-01").order("start_at", { ascending: false }).limit(5);
    expect(res.error).toBeNull();
    expect(calls[0]!.text).toBe(
      'select "appointments"."id", "appointments"."status" from "appointments" where "appointments"."status" = any($1) and "appointments"."start_at" >= $2 order by "appointments"."start_at" desc limit 5',
    );
    expect(calls[0]!.values).toEqual([["a", "b"], "2026-01-01"]);
  });

  it("embeds one-to-many relations", async () => {
    const { db, calls } = fakePool();
    await db.from("services").select("*, service_variants(size_key,price_cents)").order("display_order");
    expect(calls[0]!.text).toContain('select "services".*, coalesce((select json_agg(row_to_json(e)) from (select "size_key", "price_cents" from "service_variants"');
    expect(calls[0]!.text).toContain('where "service_variants"."service_id" = "services"."id") e), \'[]\'::json) as "service_variants"');
  });

  it("maybeSingle returns null for no rows and single errors", async () => {
    const { db } = fakePool([]);
    expect((await db.from("services").select("id").eq("id", "x").maybeSingle()).data).toBeNull();
    const one = await db.from("services").select("id").eq("id", "x").single();
    expect(one.error?.code).toBe("PGRST116");
  });

  it("head count selects count(*) and returns it", async () => {
    const { db, calls } = fakePool([{ c: 3 }]);
    const res = await db.from("notification_logs").select("id", { count: "exact", head: true }).eq("kind", "k");
    expect(res.count).toBe(3);
    expect(calls[0]!.text).toBe('select count(*)::int as c from "notification_logs" where "notification_logs"."kind" = $1');
  });

  it("insert/update/upsert/delete bind values and only return rows when select() follows", async () => {
    const { db, calls } = fakePool([{ id: "n" }]);
    expect((await db.from("promotions").insert({ title_bg: "x", service_ids: ["u"] })).data).toBeNull();
    expect(calls[0]!.text).toBe('insert into "promotions" ("title_bg", "service_ids") values ($1, $2)');
    const saved = await db.from("services").update({ name_bg: "y" }).eq("id", "i").select("id").single();
    expect(saved.data).toEqual({ id: "n" });
    expect(calls[1]!.text).toBe('update "services" set "name_bg" = $1 where "services"."id" = $2 returning "id"');
    await db.from("site_content").upsert({ key: "k", content_bg: "b" });
    expect(calls[2]!.text).toBe('insert into "site_content" ("key", "content_bg") values ($1, $2) on conflict ("key") do update set "content_bg" = excluded."content_bg"');
    await db.from("promotions").delete().eq("id", "p");
    expect(calls[3]!.text).toBe('delete from "promotions" where "promotions"."id" = $1');
  });

  it("refuses unfiltered update/delete and unsafe identifiers", async () => {
    const { db } = fakePool();
    expect((await db.from("services").delete()).error?.message).toMatch(/without a filter/);
    expect((await db.from("services").update({ a: 1 })).error?.message).toMatch(/without a filter/);
    expect((await db.from("services").select("id").eq('id"; drop table x; --', 1)).error?.message).toMatch(/invalid identifier/);
    expect(() => db.from("services; drop table x")).toThrow(/invalid identifier/);
  });

  it("serialises objects as JSON for json columns and rpc named arguments", async () => {
    const { db, calls } = fakePool([{ r: { ok: true } }]);
    await db.from("business_settings").update({ socials: { a: "b" } }).eq("id", true);
    expect(calls[0]!.values[0]).toBe('{"a":"b"}');
    const out = await db.rpc<{ ok: boolean }>("admin_replace_weekly_hours", { p_resource: "r", p_hours: [{ weekday: 1 }] });
    expect(out).toEqual({ ok: true });
    expect(calls[1]!.text).toBe('select public."admin_replace_weekly_hours"("p_resource" => $1, "p_hours" => $2) as r');
    expect(calls[1]!.values).toEqual(["r", '[{"weekday":1}]']);
  });
});
