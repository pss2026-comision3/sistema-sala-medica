import type { ReactNode } from "react";

import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/guards";
import { AppShell } from "@/components/app-shell";

export default async function AppGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  const sesion = await requireSession();
  if (sesion.claveTemporal) redirect("/cambiar-clave");

  return <AppShell sesion={sesion}>{children}</AppShell>;
}
