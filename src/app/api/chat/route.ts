import type { NextRequest } from "next/server";
import { z } from "zod";
import { guarded, json } from "@/lib/api/http";
import { serverEnv } from "@/lib/env";
import { createRpc } from "@/lib/booking/runtime";
import { clientIp, allowRequest } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  message: z.string().trim().min(1).max(1000),
  // Random id created by the browser per chat; n8n uses it as the memory key. Not a secret and not an identity.
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
  locale: z.enum(["bg", "en"]),
});

// Public: relays one chat message to the n8n workflow over the internal Docker network. The browser never talks to
// n8n; n8n's webhook is not published and additionally requires BOT_SECRET.
export function POST(req: NextRequest) {
  return guarded(async () => {
    const env = serverEnv();
    if (!env.N8N_CHAT_WEBHOOK_URL || !env.BOT_SECRET) return json({ ok: false, error: "not_configured" }, 503);

    const body = bodySchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return json({ ok: false, error: "invalid_input" }, 400);

    const ip = clientIp(req.headers);
    // 20 messages / 10 min / IP keeps LLM cost bounded; the booking endpoint has its own, stricter limits.
    if (!(await allowRequest(createRpc(), "chat", ip, 20, 600))) return json({ ok: false, error: "rate_limited" }, 429);

    try {
      const res = await fetch(env.N8N_CHAT_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-bot-secret": env.BOT_SECRET, "x-visitor-ip": ip },
        body: JSON.stringify(body.data),
        signal: AbortSignal.timeout(60_000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`n8n responded ${res.status}`);
      const data = (await res.json()) as { reply?: unknown };
      if (typeof data.reply !== "string" || !data.reply) throw new Error("n8n returned no reply");
      return json({ ok: true, reply: data.reply.slice(0, 4000) });
    } catch (err) {
      console.error("[chat] n8n call failed:", err instanceof Error ? err.message : err);
      return json({ ok: false, error: "chat_unavailable" }, 502);
    }
  });
}
