import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, guarded, json } from "@/lib/api/http";
import { createBookingDeps } from "@/lib/booking/runtime";
import { listAvailableDays } from "@/lib/booking/slots";
import { allowRequest, clientIp } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  service: z.uuid(),
  variant: z.uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// Public: which dates in a range have at least one bookable slot (drives the calendar).
export function GET(req: NextRequest) {
  return guarded(async () => {
    const q = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!q.success) return errorResponse("invalid_input");
    const deps = createBookingDeps();
    if (!(await allowRequest(deps.rpc, "availability", clientIp(req.headers), 120, 60))) return errorResponse("rate_limited");
    const r = await listAvailableDays(deps, { serviceId: q.data.service, variantId: q.data.variant ?? null, from: q.data.from, to: q.data.to });
    return r.ok ? json(r) : errorResponse(r.error);
  });
}
