"use server";

import { unstable_rethrow } from "next/navigation";
import { huellaReporte } from "@/lib/reportes/exportacion/huella";

import { requireAlgunRol, requireRole } from "@/lib/auth/guards";
import {
  consultarReporteAsistencia,
  obtenerEspecialidadesParaFiltro,
  obtenerMedicosParaFiltro,
} from "@/lib/reportes/asistencia-recordatorios";
import { consultarReporteOcupacion } from "@/lib/reportes/turnos-ocupacion";
import { consultarReporteInventario } from "@/lib/reportes/inventario";
import { consultarReporteCobertura } from "@/lib/reportes/cobros-cobertura";
import type {
  FiltrosReporteAsistencia,
  FiltrosReporteInventario,
  MedicoOpcion,
  OpcionSelector,
  ResultadoReporteAsistencia,
  FiltrosReporteOcupacion,
  ResultadoReporteOcupacion,
  ResultadoReporteInventario,
  FiltrosReporteCobertura,
  ResultadoReporteCobertura,
} from "@/lib/reportes/tipos";

export type RespuestaReporteAsistencia =
  | { exito: true; datos: ResultadoReporteAsistencia; huella: string }
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

    return { exito: true, datos, huella: huellaReporte(datos) };
  } catch (error) {
    unstable_rethrow(error); // deja pasar redirect() (sesión vencida → /login)
    console.error(
      "[obtenerReporteAsistenciaAction] Error generando reporte:",
      error,
    );
    return {
      exito: false,
      error:
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado al generar el reporte.",
    };
  }
}

export type RespuestaReporteInventario =
  | { exito: true; datos: ResultadoReporteInventario; huella: string }
  | { exito: false; error: string };

/**
 * Server Action para consultar el reporte de inventario (US-SIG-036).
 *
 * Solo el Administrador puede acceder. El reporte es de solo lectura: no
 * modifica inventario ni consulta datos clínicos.
 */
export async function obtenerReporteInventarioAction(
  filtros: FiltrosReporteInventario,
): Promise<RespuestaReporteInventario> {
  await requireRole("ADMIN");

  try {
    const datos = await consultarReporteInventario(filtros);
    return { exito: true, datos, huella: huellaReporte(datos) };
  } catch (error) {
    console.error(
      "[obtenerReporteInventarioAction] Error generando reporte:",
      error,
    );
    return {
      exito: false,
      error:
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado al generar el reporte de inventario.",
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
export async function obtenerEspecialidadesFiltroAction(): Promise<
  OpcionSelector[]
> {
  try {
    await requireAlgunRol("ADMIN", "MEDICO");
    return await obtenerEspecialidadesParaFiltro();
  } catch {
    return [];
  }
}

export type RespuestaReporteOcupacion =
  | { exito: true; datos: ResultadoReporteOcupacion; huella: string }
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
    return { exito: true, datos, huella: huellaReporte(datos) };
  } catch (error) {
    unstable_rethrow(error); // deja pasar redirect() (sesión vencida → /login)
    console.error(
      "[obtenerReporteOcupacionAction] Error generando reporte:",
      error,
    );
    return {
      exito: false,
      error:
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado al generar el reporte.",
    };
  }
}

export type RespuestaReporteCobertura =
  | { exito: true; datos: ResultadoReporteCobertura; huella: string }
  | { exito: false; error: string };

/**
 * Server Action del reporte de prestaciones con cobertura (US-SIG-037).
 * CA5: solo el Administrador consulta el reporte agregado de toda la sala.
 */
export async function obtenerReporteCoberturaAction(
  filtros: FiltrosReporteCobertura,
): Promise<RespuestaReporteCobertura> {
  try {
    await requireRole("ADMIN");
    const datos = await consultarReporteCobertura(filtros);
    return { exito: true, datos, huella: huellaReporte(datos) };
  } catch (error) {
    unstable_rethrow(error); // deja pasar redirect() (sesión vencida → /login)
    console.error(
      "[obtenerReporteCoberturaAction] Error generando reporte:",
      error,
    );
    return {
      exito: false,
      error:
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado al generar el reporte de prestaciones.",
    };
  }
}
