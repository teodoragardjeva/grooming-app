import { redirect } from "next/navigation";

/** Post/redirect/get messaging via query string (no client JS needed). */
export function back(path: string, kind: "ok" | "err", msg: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${kind}=${encodeURIComponent(msg)}`);
}
