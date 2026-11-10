export const dynamic = "force-dynamic"; // per-request auth: never prerender admin pages
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/admin/auth";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireAdmin();
  return (
    <>
      <AdminNav email={email} />
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </>
  );
}
