// Optional bot protection (Cloudflare Turnstile). When TURNSTILE_SECRET_KEY is unset it is skipped.
export async function verifyTurnstile(
  token: string | undefined,
  ip: string,
  secret: string | undefined,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res = await fetchFn("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    return false;
  }
}
