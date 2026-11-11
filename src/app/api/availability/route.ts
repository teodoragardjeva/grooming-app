import type { NextRequest } from "next/server";
import { errorResponse, guarded, json } from "@/lib/api/http";
import { createBookingDeps } from "@/lib/booking/runtime";
import { availabilityQuerySchema } from "@/lib/booking/schemas";
import { listSlots } from "@/lib/booking/slots";
import { serverEnv } from "@/lib/env";
import { requestIp } from "@/lib/security/bot-auth";
import { allowRequest } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

// Public: free/unavailable start times for one service/variant on one studio-local date. No customer data.
export function GET(req: NextRequest) {
  return guarded(async () => {
    const q = availabilityQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!q.success) return errorResponse("invalid_input");
    const deps = createBookingDeps();
    if (!(await allowRequest(deps.rpc, "availability", requestIp(req.headers, serverEnv().BOT_SECRET), 120, 60))) return errorResponse("rate_limited");
    const r = await listSlots(deps, { serviceId: q.data.service, variantId: q.data.variant ?? null, date: q.data.date });
    return r.ok ? json(r) : errorResponse(r.error);
  });
}
