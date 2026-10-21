import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/guards";

/**
 * US-SIG-015 CA1: Médico, Enfermería y Administración pueden operar acá.
 * No es un único rol, por eso no usa `requireRole` (que exige exactamente
 * uno): se valida la lista de roles permitidos directamente.
 */
export default async function TurnosPresencialesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await requireSession();
  if (sesion.claveTemporal) redirect("/cambiar-clave");
  if (!["MEDICO", "ENFERMERIA", "ADMIN"].includes(sesion.rol)) {
    redirect("/sin-permiso");
  }
  return children;
}
