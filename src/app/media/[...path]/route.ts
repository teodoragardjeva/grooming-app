import type { NextRequest } from "next/server";
import { readMedia } from "@/lib/media";

export const dynamic = "force-dynamic";

// Public read of uploaded images. File names are random UUIDs and never change, so they are cached for a year.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const file = await readMedia(path.join("/"));
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
