"use server";

import { requireAlgunRol } from "@/lib/auth/guards";
import {
  consultarReporteAsistencia,
  obtenerEspecialidadesParaFiltro,
  obtenerMedicosParaFiltro,
} from "@/lib/reportes/asistencia-recordatorios";
import type {
  FiltrosReporteAsistencia,
  MedicoOpcion,
  OpcionSelector,
  ResultadoReporteAsistencia,
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
