import type { ReactNode } from "react";

/** Dark title band used by inner pages; content below sits on parchment. */
export function PageHero({ title, intro }: { title: string; intro?: string }) {
  return (
    <section className="bg-burgundy-900 px-4 py-12 text-parchment-50 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-4xl text-gold-100 sm:text-5xl">{title}</h1>
        {intro && <p className="mt-3 max-w-2xl text-lg text-parchment-100">{intro}</p>}
      </div>
    </section>
  );
}

export function PageSection({ children }: { children: ReactNode }) {
  return <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">{children}</section>;
}
