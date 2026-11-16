/**
 * Catálogo central de reportes del sistema SIGSAM.
 *
 * Registra los reportes de Asistencia (US-SIG-035), Ocupación (US-SIG-034) e
 * Inventario de vacunas (US-SIG-036) y Prestaciones con cobertura (US-SIG-037).
 */

export type TipoReporte =
  | "asistencia_recordatorios"
  | "turnos_ocupacion"
  | "inventario"
  | "cobros_cobertura";

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
    id: "turnos_ocupacion",
    titulo: "Turnos asignados y ocupación de agenda",
    descripcion:
      "Distribución de reservas y ocupación de cupos por médico y especialidad (US-SIG-034).",
    rolesPermitidos: ["ADMIN", "MEDICO"],
  },
  {
    id: "inventario",
    titulo: "Inventario de vacunas y su evolución",
    descripcion:
      "Consulta existencias físicas por vacuna y lote, y reconstruye la evolución del stock en un período.",
    rolesPermitidos: ["ADMIN"],
  },
  {
    // US-SIG-037 CA5: solo el Administrador consulta el reporte agregado.
    // Alcance recortado (sin US-029/030): solo la sección de prestaciones.
    id: "cobros_cobertura",
    titulo: "Prestaciones con cobertura",
    descripcion:
      "Clasifica las prestaciones atendidas en Particular, Gratuita o Con cobertura registrada, por entidad, médico y especialidad.",
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
