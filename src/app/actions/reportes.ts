"use server";

import { unstable_rethrow } from "next/navigation";

import { requireAlgunRol } from "@/lib/auth/guards";
import {
  consultarReporteAsistencia,
  obtenerEspecialidadesParaFiltro,
  obtenerMedicosParaFiltro,
} from "@/lib/reportes/asistencia-recordatorios";
import { consultarReporteOcupacion } from "@/lib/reportes/turnos-ocupacion";
import type {
  FiltrosReporteAsistencia,
  MedicoOpcion,
  OpcionSelector,
  ResultadoReporteAsistencia,
  FiltrosReporteOcupacion,
  ResultadoReporteOcupacion,
} from "@/lib/reportes/tipos";

export type RespuestaReporteAsistencia =
  | { exito: true; datos: ResultadoReporteAsistencia }
  | { exito: false; error: string };

/**
 * Server Action para consultar el reporte de asistencia, ausentismo y recordatorios (US-SIG-035).
 *
 * Verificaciones de seguridad (CA5):
 * - Requiere rol ADMIN o MEDICO.
 * - Si es MEDICO, el servicio forza el filtro sobre su propio ID de profesional.
 */
export async function obtenerReporteAsistenciaAction(
  filtros: FiltrosReporteAsistencia,
): Promise<RespuestaReporteAsistencia> {
  try {
    const sesion = await requireAlgunRol("ADMIN", "MEDICO");

    const datos = await consultarReporteAsistencia(filtros, {
      usuarioId: sesion.usuarioId,
      rol: sesion.rol as "ADMIN" | "MEDICO",
    });

    return { exito: true, datos };
  } catch (error) {
    unstable_rethrow(error); // deja pasar redirect() (sesión vencida → /login)
    console.error("[obtenerReporteAsistenciaAction] Error generando reporte:", error);
    return {
      exito: false,
      error:
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado al generar el reporte.",
    };
  }
}

/**
 * Server Action para obtener los médicos habilitados para el filtro.
 */
export async function obtenerMedicosFiltroAction(): Promise<MedicoOpcion[]> {
  try {
    await requireAlgunRol("ADMIN", "MEDICO");
    return await obtenerMedicosParaFiltro();
  } catch {
    return [];
  }
}

/**
 * Server Action para obtener las especialidades para el filtro.
 */
export async function obtenerEspecialidadesFiltroAction(): Promise<OpcionSelector[]> {
  try {
    await requireAlgunRol("ADMIN", "MEDICO");
    return await obtenerEspecialidadesParaFiltro();
  } catch {
    return [];
  }
}

export type RespuestaReporteOcupacion =
  | { exito: true; datos: ResultadoReporteOcupacion }
  | { exito: false; error: string };

/**
 * Server Action del reporte de turnos y ocupación (US-SIG-034).
 * CA5: requiere ADMIN o MEDICO; si es MEDICO, el servicio fuerza su propio ID.
 */
export async function obtenerReporteOcupacionAction(
  filtros: FiltrosReporteOcupacion,
): Promise<RespuestaReporteOcupacion> {
  try {
    const sesion = await requireAlgunRol("ADMIN", "MEDICO");
    const datos = await consultarReporteOcupacion(filtros, {
      usuarioId: sesion.usuarioId,
      rol: sesion.rol as "ADMIN" | "MEDICO",
    });
    return { exito: true, datos };
  } catch (error) {
    unstable_rethrow(error); // deja pasar redirect() (sesión vencida → /login)
    console.error("[obtenerReporteOcupacionAction] Error generando reporte:", error);
    return {
      exito: false,
      error:
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado al generar el reporte.",
    };
  }
}