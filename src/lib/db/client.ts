// Small query builder over node-postgres with the call shape the app uses
// (from().select().eq()…, insert/update/upsert/delete, rpc). Returns { data, error, count } and never throws
// for database errors. SERVER ONLY. All identifiers are validated; all values are bound parameters.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Pool } from "pg";

export interface DbError {
  message: string;
  code?: string;
}
export interface DbResult<T = any[]> {
  data: T | null;
  error: DbError | null;
  count: number | null;
}
export type Rpc = <T = unknown>(fn: string, args?: Record<string, unknown>) => Promise<T>;

/** One-to-many relations that can be embedded in select("…, relation(cols)"). */
const RELATIONS: Record<string, Record<string, { table: string; fk: string }>> = {
  services: { service_variants: { table: "service_variants", fk: "service_id" } },
};

/** Default conflict target for upsert() when none is given. */
const PRIMARY_KEYS: Record<string, string> = { site_content: "key", business_settings: "id" };

const IDENT = /^[a-z_][a-z0-9_]*$/;
const q = (name: string): string => {
  if (!IDENT.test(name)) throw new Error(`invalid identifier: ${name}`);
  return `"${name}"`;
};

type Op = "=" | ">" | ">=" | "<" | "<=" | "in";
interface Filter {
  col: string;
  op: Op;
  val: unknown;
}

function splitTop(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of list) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function plainColumns(cols: string, table: string): string {
  return splitTop(cols)
    .map((c) => (c === "*" ? `${q(table)}.*` : q(c)))
    .join(", ");
}

class Query<T = any[]> implements PromiseLike<DbResult<T>> {
  private action: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private cols = "*";
  private filters: Filter[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private lim: number | null = null;
  private payload: Record<string, unknown> | Record<string, unknown>[] | null = null;
  private onConflict: string | null = null;
  private returning = false;
  private head = false;
  private mode: "one" | "maybe" | null = null;

  private readonly pool: Pool;
  private readonly table: string;

  constructor(pool: Pool, table: string) {
    this.pool = pool;
    this.table = table;
    q(table);
  }

  select(cols = "*", opts?: { count?: "exact"; head?: boolean }): this {
    this.cols = cols;
    if (this.action !== "select") this.returning = true;
    if (opts?.head) this.head = true;
    return this;
  }
  insert(row: Record<string, unknown> | Record<string, unknown>[]): this {
    this.action = "insert";
    this.payload = row;
    return this;
  }
  update(row: Record<string, unknown>): this {
    this.action = "update";
    this.payload = row;
    return this;
  }
  upsert(row: Record<string, unknown> | Record<string, unknown>[], opts?: { onConflict?: string }): this {
    this.action = "upsert";
    this.payload = row;
    this.onConflict = opts?.onConflict ?? null;
    return this;
  }
  delete(): this {
    this.action = "delete";
    return this;
  }

  eq(col: string, val: unknown): this { return this.where(col, "=", val); }
  gt(col: string, val: unknown): this { return this.where(col, ">", val); }
  gte(col: string, val: unknown): this { return this.where(col, ">=", val); }
  lt(col: string, val: unknown): this { return this.where(col, "<", val); }
  lte(col: string, val: unknown): this { return this.where(col, "<=", val); }
  in(col: string, vals: readonly unknown[]): this { return this.where(col, "in", vals); }
  private where(col: string, op: Op, val: unknown): this {
    this.filters.push({ col, op, val });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }): this {
    this.orders.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number): this {
    this.lim = n;
    return this;
  }
  maybeSingle(): Query<any> {
    this.mode = "maybe";
    return this as Query<any>;
  }
  /** Exactly one row, otherwise an error. */
  single(): Query<any> {
    this.mode = "one";
    return this as Query<any>;
  }

  then<R1 = DbResult<T>, R2 = never>(
    onfulfilled?: ((value: DbResult<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }

  private async run(): Promise<DbResult<T>> {
    try {
      const { text, values } = this.build();
      const res = await this.pool.query(text, values);
      if (this.head) return { data: null, error: null, count: Number(res.rows[0]?.c ?? 0) };
      const rows = res.rows as Record<string, unknown>[];
      const wantsRows = this.action === "select" || this.returning;
      if (!wantsRows) return { data: null, error: null, count: null };
      if (this.mode === "maybe") {
        if (rows.length > 1) return fail("multiple rows returned", "PGRST116");
        return { data: (rows[0] ?? null) as T | null, error: null, count: null };
      }
      if (this.mode === "one") {
        if (rows.length !== 1) return fail("expected exactly one row", "PGRST116");
        return { data: rows[0] as T, error: null, count: null };
      }
      return { data: rows as T, error: null, count: null };
    } catch (err) {
      const e = err as { message?: string; code?: string };
      return fail(e.message ?? String(err), e.code);
    }
  }

  private build(): { text: string; values: unknown[] } {
    const values: unknown[] = [];
    const bind = (v: unknown): string => {
      values.push(v);
      return `$${values.length}`;
    };
    const t = q(this.table);

    const whereSql = (): string => {
      if (this.filters.length === 0) return "";
      const parts = this.filters.map((f) => {
        const c = `${t}.${q(f.col)}`;
        if (f.op === "in") return `${c} = any(${bind(f.val)})`;
        if (f.op === "=" && f.val === null) return `${c} is null`;
        return `${c} ${f.op} ${bind(f.val)}`;
      });
      return ` where ${parts.join(" and ")}`;
    };
    const returningSql = (): string => (this.returning ? ` returning ${plainColumns(this.cols, this.table)}` : "");

    if (this.action === "select") {
      if (this.head) return { text: `select count(*)::int as c from ${t}${whereSql()}`, values };
      const rel = RELATIONS[this.table] ?? {};
      const select = splitTop(this.cols)
        .map((c) => {
          const m = /^([a-z_][a-z0-9_]*)\((.*)\)$/s.exec(c);
          if (!m) return c === "*" ? `${t}.*` : `${t}.${q(c)}`;
          const r = rel[m[1]!];
          if (!r) throw new Error(`unknown relation ${this.table}.${m[1]}`);
          const inner = plainColumns(m[2]!, r.table);
          return (
            `coalesce((select json_agg(row_to_json(e)) from (select ${inner} from ${q(r.table)} ` +
            `where ${q(r.table)}.${q(r.fk)} = ${t}."id") e), '[]'::json) as ${q(m[1]!)}`
          );
        })
        .join(", ");
      const order = this.orders.length ? ` order by ${this.orders.map((o) => `${t}.${q(o.col)} ${o.asc ? "asc" : "desc"}`).join(", ")}` : "";
      const limit = this.mode === "maybe" || this.mode === "one" ? " limit 2" : this.lim != null ? ` limit ${Math.trunc(this.lim)}` : "";
      return { text: `select ${select} from ${t}${whereSql()}${order}${limit}`, values };
    }

    if (this.action === "delete") {
      if (this.filters.length === 0) throw new Error("delete() without a filter is not allowed");
      return { text: `delete from ${t}${whereSql()}${returningSql()}`, values };
    }

    if (this.action === "update") {
      if (this.filters.length === 0) throw new Error("update() without a filter is not allowed");
      const entries = Object.entries(this.payload as Record<string, unknown>).filter(([, v]) => v !== undefined);
      if (entries.length === 0) throw new Error("update() without values");
      const set = entries.map(([k, v]) => `${q(k)} = ${bind(encode(v))}`).join(", ");
      return { text: `update ${t} set ${set}${whereSql()}${returningSql()}`, values };
    }

    // insert / upsert
    const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Record<string, unknown>[];
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r).filter((k) => r[k] !== undefined)))];
    if (cols.length === 0) throw new Error("insert() without values");
    const tuples = rows.map((r) => `(${cols.map((c) => (r[c] === undefined ? "default" : bind(encode(r[c])))).join(", ")})`);
    let sql = `insert into ${t} (${cols.map(q).join(", ")}) values ${tuples.join(", ")}`;
    if (this.action === "upsert") {
      const target = (this.onConflict ?? PRIMARY_KEYS[this.table] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      if (target.length === 0) throw new Error(`upsert() into ${this.table} needs onConflict`);
      const updates = cols.filter((c) => !target.includes(c));
      sql += ` on conflict (${target.map(q).join(", ")}) ` + (updates.length ? `do update set ${updates.map((c) => `${q(c)} = excluded.${q(c)}`).join(", ")}` : "do nothing");
    }
    return { text: sql + returningSql(), values };
  }
}

function fail<T>(message: string, code?: string): DbResult<T> {
  return { data: null, error: { message, code }, count: null };
}

/** Plain objects/arrays-of-objects are sent as JSON (json/jsonb columns); uuid[]/text[] arrays stay arrays. */
function encode(v: unknown): unknown {
  if (v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && !Buffer.isBuffer(v)) return JSON.stringify(v);
  if (Array.isArray(v) && v.some((x) => x !== null && typeof x === "object" && !(x instanceof Date))) return JSON.stringify(v);
  return v;
}

export interface Db {
  from(table: string): Query<any[]>;
  rpc: Rpc;
}

export function createDb(pool: Pool): Db {
  const rpc: Rpc = async <T = unknown>(fn: string, args: Record<string, unknown> = {}) => {
    const keys = Object.keys(args);
    const named = keys.map((k, i) => `${q(k)} => $${i + 1}`).join(", ");
    const params = keys.map((k) => encode(args[k]));
    try {
      const { rows } = await pool.query(`select public.${q(fn)}(${named}) as r`, params);
      return rows[0]?.r as T;
    } catch (err) {
      throw new Error(`rpc ${fn} failed: ${(err as Error).message}`);
    }
  };
  return { from: (table) => new Query(pool, table), rpc };
}
