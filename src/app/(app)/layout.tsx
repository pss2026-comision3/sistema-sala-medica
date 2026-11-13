import type { ReactNode } from "react";

import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/guards";
import { AppShell } from "@/components/app-shell";
import { contarAvisosNoLeidos } from "@/lib/notificaciones/avisos";

export default async function AppGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  const sesion = await requireSession();
  if (sesion.claveTemporal) redirect("/cambiar-clave");

  // El conteo se recalcula en SSR en cada navegación (badge siempre fresco)
  const avisosNoLeidos = await contarAvisosNoLeidos(BigInt(sesion.usuarioId));

  return (
    <AppShell sesion={sesion} avisosNoLeidos={avisosNoLeidos}>
      {children}
    </AppShell>
  );
}
