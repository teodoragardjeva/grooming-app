"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, MessageCircle, Send, X } from "lucide-react";

interface Msg {
  role: "user" | "bot";
  text: string;
}

const STORAGE_KEY = "chat-session-id";

// Random per-browser conversation id (memory key in n8n). Falls back to memory-only if storage is blocked.
function getSessionId(): string {
  const make = () => crypto.randomUUID().replace(/-/g, "");
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing;
    const id = make();
    sessionStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return make();
  }
}

export function ChatBubble() {
  const t = useTranslations("chat");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const sessionId = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, busy, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    sessionId.current ??= getSessionId();
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: sessionId.current, locale: locale === "en" ? "en" : "bg" }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; reply?: string; error?: string } | null;
      let reply = t("error");
      if (data?.ok && data.reply) reply = data.reply;
      else if (res.status === 429) reply = t("rateLimited");
      else if (res.status === 503) reply = t("unavailable");
      setMessages((m) => [...m, { role: "bot", text: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "bot", text: t("error") }]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("open")}
        className="fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gold-400 text-burgundy-900 shadow-lg transition hover:bg-gold-500 focus-visible:outline-offset-2"
      >
        <MessageCircle aria-hidden className="h-6 w-6" />
      </button>
    );
  }

  return (
    <section
      aria-label={t("title")}
      className="fixed bottom-4 right-4 z-40 flex h-[32rem] max-h-[calc(100vh-2rem)] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-gold-500 bg-white shadow-2xl"
    >
      <header className="flex items-center justify-between bg-burgundy-900 px-4 py-3 text-gold-100">
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label={t("close")} className="rounded p-1 hover:bg-burgundy-700">
          <X aria-hidden className="h-5 w-5" />
        </button>
      </header>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3 text-sm" aria-live="polite">
        <p className="max-w-[85%] rounded-2xl rounded-bl-sm bg-gold-100 px-3 py-2 text-burgundy-900">{t("welcome")}</p>
        {messages.map((m, i) => (
          <p
            key={i}
            className={
              m.role === "user"
                ? "ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-burgundy-800 px-3 py-2 text-white"
                : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-gold-100 px-3 py-2 text-burgundy-900"
            }
          >
            {m.text}
          </p>
        ))}
        {busy && (
          <p className="flex items-center gap-2 text-xs text-burgundy-800">
            <Loader2 aria-hidden className="h-3 w-3 animate-spin" /> {t("thinking")}
          </p>
        )}
      </div>

      <form onSubmit={send} className="border-t border-gold-400 p-2">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={1000}
            placeholder={t("placeholder")}
            aria-label={t("placeholder")}
            className="min-w-0 flex-1 rounded-full border border-burgundy-700 px-3 py-2 text-sm text-burgundy-900"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label={t("send")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-burgundy-800 text-white disabled:opacity-50"
          >
            <Send aria-hidden className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 px-1 text-[11px] leading-snug text-burgundy-800">{t("disclaimer")}</p>
      </form>
    </section>
  );
}
