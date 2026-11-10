import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { guarded, json } from "@/lib/api/http";
import { serverEnv } from "@/lib/env";
import { createRpc } from "@/lib/booking/runtime";

export const dynamic = "force-dynamic";

// Backup housekeeping only: correctness never depends on it (expired holds are released at request time).
// Protected by CRON_SECRET (the scheduler must send "Authorization: Bearer <CRON_SECRET>").
export function GET(req: NextRequest) {
  return guarded(async () => {
    const secret = serverEnv().CRON_SECRET;
    const given = req.headers.get("authorization") ?? "";
    const expected = `Bearer ${secret ?? ""}`;
    const ok = !!secret && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
    if (!ok) return json({ ok: false, error: "unauthorized" }, 401);
    const result = await createRpc()("housekeeping");
    return json({ ok: true, result });
  });
}
