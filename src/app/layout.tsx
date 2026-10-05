import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIGSAM — Sala Médica",
  description: "Sistema Integral de Gestión para Sala Médica",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
