"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/** Explicit POST button (links in emails must never change state on GET; scanners prefetch links). */
export function TokenAction({ kind, token }: { kind: "confirm" | "cancel"; token: string }) {
  const t = useTranslations("booking");
  const te = useTranslations("errors");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setState("busy");
    setError(null);
    const res = await fetch(`/api/booking/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: "internal" }));
    if (res.ok) setState("done");
    else { setState("idle"); setError(res.error); }
  }

  if (state === "done") {
    return (
      <div role="status" className="rounded-2xl bg-parchment-100 p-6">
        <h2 className="text-2xl text-burgundy-900">{t(kind === "confirm" ? "confirmedTitle" : "cancelledTitle")}</h2>
        <p className="mt-2">{t(kind === "confirm" ? "confirmedBody" : "cancelledBody")}</p>
        {kind === "cancel" && <Button asChild className="mt-4"><Link href="/booking">{t("bookAgain")}</Link></Button>}
      </div>
    );
  }
  return (
    <div>
      {error && <p className="mb-3 rounded-lg bg-red-100 p-3 text-red-900" role="alert">{te.has(error as never) ? te(error as never) : te("internal")}</p>}
      <Button onClick={run} loading={state === "busy"}>{t(kind === "confirm" ? "confirmButton" : "cancelButton")}</Button>
    </div>
  );
}
