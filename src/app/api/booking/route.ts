import type { NextRequest } from "next/server";
import { errorResponse, guarded, json } from "@/lib/api/http";
import { serverEnv } from "@/lib/env";
import { createBookingDeps } from "@/lib/booking/runtime";
import { createPublicBooking } from "@/lib/booking/public";
import { bookingRequestSchema } from "@/lib/booking/schemas";
import { allowRequest, clientIp } from "@/lib/security/rate-limit";
import { verifyTurnstile } from "@/lib/security/turnstile";

export const dynamic = "force-dynamic";

// Public: creates a pending hold + sends the confirmation email. All validation is repeated here and in the DB.
export function POST(req: NextRequest) {
  return guarded(async () => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse("invalid_input");
    }
    const parsed = bookingRequestSchema.safeParse(body);
    if (!parsed.success) {
      const fields = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))];
      return errorResponse("invalid_input", { fields });
    }
    const ip = clientIp(req.headers);
    const deps = createBookingDeps();
    // 5 requests / 10 min / IP, plus 3 / 10 min per email address.
    if (!(await allowRequest(deps.rpc, "booking", ip, 5, 600))) return errorResponse("rate_limited");
    if (!(await allowRequest(deps.rpc, "booking-email", parsed.data.email.toLowerCase(), 3, 600))) return errorResponse("rate_limited");
    if (!(await verifyTurnstile(parsed.data.turnstileToken, ip, serverEnv().TURNSTILE_SECRET_KEY))) return errorResponse("captcha_failed");

    const r = await createPublicBooking(deps, parsed.data);
    return r.ok ? json(r, 201) : errorResponse(r.error);
  });
}
