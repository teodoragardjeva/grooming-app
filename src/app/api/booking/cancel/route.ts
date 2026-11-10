import type { NextRequest } from "next/server";
import { errorResponse, guarded, json } from "@/lib/api/http";
import { createBookingDeps } from "@/lib/booking/runtime";
import { cancelBookingByToken } from "@/lib/booking/public";
import { tokenBodySchema } from "@/lib/booking/schemas";
import { allowRequest, clientIp } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export function POST(req: NextRequest) {
  return guarded(async () => {
    const body = tokenBodySchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return errorResponse("invalid_input");
    const deps = createBookingDeps();
    if (!(await allowRequest(deps.rpc, "cancel", clientIp(req.headers), 20, 600))) return errorResponse("rate_limited");
    const r = await cancelBookingByToken(deps, body.data.token);
    return r.ok ? json(r) : errorResponse(r.error, r.deadline ? { deadline: r.deadline } : {});
  });
}
