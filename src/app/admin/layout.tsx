import type { Metadata } from "next";
import "@fontsource-variable/open-sans";
import "@fontsource-variable/eb-garamond";
import "../globals.css";

export const metadata: Metadata = {
  title: "Админ – Магически Лапички",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
