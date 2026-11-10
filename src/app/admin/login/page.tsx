import { Logo } from "@/components/layout/logo";
import { S } from "@/lib/admin/strings";
import { SubmitButton } from "@/components/ui/submit-button";
import { loginAction } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  const msg = e === "invalid" ? S.login.invalid : e === "forbidden" ? S.login.forbidden : e === "config" ? S.login.config : e === "rate" ? S.login.rate : null;
  const field = "mt-1 w-full rounded-lg border border-burgundy-800/40 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500";
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="overflow-hidden rounded-2xl border border-gold-400/50 shadow-xl shadow-black/20">
      <div className="flex items-center gap-3 bg-wine px-6 py-4">
        <Logo className="h-14" />
        <span className="flex flex-col leading-tight">
          <span className="font-serif text-3xl font-bold text-gold-400">{S.brand}</span>
          <span className="text-sm text-cream-50">{S.adminTag}</span>
        </span>
      </div>
      <div className="bg-parchment-100/70 px-6 pb-6 pt-5">
      <h1 className="text-3xl text-heading">{S.login.title}</h1>
      {msg && <p role="alert" className="mt-4 rounded-lg bg-red-100 p-3 text-red-900">{msg}</p>}
      <form action={loginAction} className="mt-6 space-y-4">
        <div><label htmlFor="email">{S.login.email}</label><input id="email" name="email" type="email" autoComplete="username" required className={field} /></div>
        <div><label htmlFor="password">{S.login.password}</label><input id="password" name="password" type="password" autoComplete="current-password" required className={field} /></div>
        <SubmitButton>{S.login.submit}</SubmitButton>
      </form>
      </div>
      </div>
    </main>
  );
}
