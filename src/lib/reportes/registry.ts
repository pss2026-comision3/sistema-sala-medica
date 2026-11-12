/**
 * Catálogo central de reportes del sistema SIGSAM.
 *
 * Actualmente registra únicamente el reporte de Asistencia, Ausencias y Recordatorios (US-SIG-035).
 * Los demás reportes planificados para el Sprint 3 (Ocupación US-034, Inventario US-036,
 * Cobros US-037) serán incorporados en este catálogo por sus respectivos responsables.
 */

export type TipoReporte = "asistencia_recordatorios";

export interface DefinicionReporte {
  id: TipoReporte;
  titulo: string;
  descripcion: string;
  rolesPermitidos: ("ADMIN" | "MEDICO")[];
}

export const CATALOGO_REPORTES: readonly DefinicionReporte[] = [
  {
    id: "asistencia_recordatorios",
    titulo: "Asistencia, ausencias y recordatorios",
    descripcion:
      "Evalúa los resultados de atención (asistencia, ausentismo y citas sin registrar) y audita descriptivamente los recordatorios enviados.",
    rolesPermitidos: ["ADMIN", "MEDICO"],
  },
  // Ejemplo de cómo se agregarían otros reportes en el futuro:
  // {
  //   id: "ocupacion",
  //   titulo: "Ocupación de salas y recursos",
  //   descripcion:
  //     "Mide la ocupación de salas y recursos en un período determinado.",
  //   rolesPermitidos: ["ADMIN"],
  // },
] as const;

export function obtenerDefinicionReporte(
  id: string,
): DefinicionReporte | undefined {
  return CATALOGO_REPORTES.find((r) => r.id === id);
}
