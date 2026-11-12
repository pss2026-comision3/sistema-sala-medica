/**
 * Catálogo central de reportes del sistema SIGSAM.
 *
 * Registra el reporte de Asistencia, Ausencias y Recordatorios (US-SIG-035) y
 * el reporte de Inventario de vacunas (US-SIG-036). Los demás reportes
 * planificados para el Sprint 3 (Ocupación US-034, Cobros US-037) serán
 * incorporados en este catálogo por sus respectivos responsables.
 */

export type TipoReporte = "asistencia_recordatorios" | "inventario";

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
  {
    id: "inventario",
    titulo: "Inventario de vacunas y su evolución",
    descripcion:
      "Consulta existencias físicas por vacuna y lote, y reconstruye la evolución del stock en un período.",
    rolesPermitidos: ["ADMIN"],
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
