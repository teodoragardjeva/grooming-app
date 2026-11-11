import type { NextRequest } from "next/server";
import { errorResponse, guarded, json } from "@/lib/api/http";
import { serverEnv } from "@/lib/env";
import { createBookingDeps } from "@/lib/booking/runtime";
import { createPublicBooking } from "@/lib/booking/public";
import { bookingRequestSchema } from "@/lib/booking/schemas";
import { isTrustedBot, requestIp } from "@/lib/security/bot-auth";
import { allowRequest } from "@/lib/security/rate-limit";
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
    const env = serverEnv();
    // Chatbot (n8n) callers present BOT_SECRET: rate-limit per visitor IP and skip Turnstile (a bot cannot solve it).
    const trustedBot = isTrustedBot(req.headers, env.BOT_SECRET);
    const ip = requestIp(req.headers, env.BOT_SECRET);
    const deps = createBookingDeps();
    // 5 requests / 10 min / IP, plus 3 / 10 min per email address.
    if (!(await allowRequest(deps.rpc, "booking", ip, 5, 600))) return errorResponse("rate_limited");
    if (!(await allowRequest(deps.rpc, "booking-email", parsed.data.email.toLowerCase(), 3, 600))) return errorResponse("rate_limited");
    if (!trustedBot && !(await verifyTurnstile(parsed.data.turnstileToken, ip, env.TURNSTILE_SECRET_KEY))) return errorResponse("captcha_failed");

    const r = await createPublicBooking(deps, parsed.data);
    return r.ok ? json(r, 201) : errorResponse(r.error);
  });
}
