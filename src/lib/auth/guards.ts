import { redirect } from "next/navigation";

import type { Rol } from "@/generated/prisma/client";

import { INICIO_POR_ROL } from "@/lib/auth/constants";
import { getSession, type SesionActual } from "@/lib/auth/session";

export async function requireSession(): Promise<SesionActual> {
  const sesion = await getSession();
  if (!sesion) redirect("/login");
  return sesion;
}

export async function requireRole(rol: Rol): Promise<SesionActual> {
  const sesion = await requireSession();
  if (sesion.claveTemporal) redirect("/cambiar-clave");
  if (sesion.rol !== rol) redirect("/sin-permiso");
  return sesion;
}

export function destinoPostLogin(sesion: SesionActual): string {
  return sesion.claveTemporal ? "/cambiar-clave" : INICIO_POR_ROL[sesion.rol];
}
