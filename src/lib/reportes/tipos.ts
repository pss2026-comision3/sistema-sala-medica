/**
 * Contratos de datos y tipos para el módulo de reportes (US-SIG-035 y US-SIG-036).
 */

export interface FiltrosReporteAsistencia {
  desde: string; // Formato YYYY-MM-DD
  hasta: string; // Formato YYYY-MM-DD
  medicoId?: string; // ID del médico (profesional_id en disponibilidad)
  especialidadId?: string; // ID de la especialidad
}

export interface MetricasAsistencia {
  atendidos: number;
  ausentes: number;
  sinRegistrar: number;
  cancelados: number;
  futurosExcluidos: number;
  porcentajeAsistencia: string; // Ej: "85.0%" o "No aplica" (CA3)
}

export interface MetricasRecordatorios {
  enviados: number; // Evento RECORDATORIO con al menos un intento EXITO (CA4)
  fallidos: number; // Evento RECORDATORIO con intentos todos FALLIDO (CA4)
  reservaTardia: number; // Reserva creada con < 24hs de antelación al inicio (CA4)
  sinRecordatorio: number; // Creado con >= 24hs pero sin evento generado
}

export type EstadoRecordatorioItem =
  | "ENVIADO"
  | "FALLIDO"
  | "RESERVA_TARDIA"
  | "SIN_RECORDATORIO";

export interface DetalleCitaReporte {
  id: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:mm
  duracionMin: number;
  paciente: string;
  medico: string;
  especialidad: string;
  estado: string; // "CONFIRMADO" | "CANCELADO"
  resultado: string; // "ATENDIDO" | "AUSENTE" | "SIN_REGISTRAR"
  estadoRecordatorio: EstadoRecordatorioItem;
  horarioTerminado: boolean;
}

export interface ResultadoReporteAsistencia {
  asistencia: MetricasAsistencia;
  recordatorios: MetricasRecordatorios;
  citas: DetalleCitaReporte[];
  periodo: {
    desde: string;
    hasta: string;
  };
}

export interface OpcionSelector {
  id: string;
  nombre: string;
}

export interface MedicoOpcion {
  id: string;
  nombre: string;
  especialidadId: string | null;
}

// ---------------------------------------------------------------------------
// US-SIG-034 — Turnos asignados y ocupación de agenda
// ---------------------------------------------------------------------------

export type EstadoFiltroOcupacion = "todos" | "CONFIRMADO" | "CANCELADO";
export type ModalidadFiltroOcupacion = "todos" | "PARTICULAR" | "CON_COBERTURA";

export interface FiltrosReporteOcupacion {
  desde: string; // YYYY-MM-DD (fecha de la cita, CA1)
  hasta: string; // YYYY-MM-DD
  medicoId?: string;
  especialidadId?: string;
  estado?: EstadoFiltroOcupacion; // solo afecta el conteo de reservas
  modalidad?: ModalidadFiltroOcupacion; // solo afecta el conteo de reservas
}

/** CA3 y CA4: ocupación calculada sobre cupos (posiciones horarias), no sobre turnos. */
export interface MetricasOcupacion {
  cuposPublicados: number;
  cuposBloqueados: number; // jornadas suspendidas: se informan aparte (CA4)
  cuposUtilizables: number; // publicados - bloqueados
  cuposOcupados: number; // utilizables con al menos una cita CONFIRMADA
  porcentajeOcupacion: string; // "75.0%" o "No aplica"
}

/** CA2: reservas definitivas. Los resultados son un desglose de las confirmadas. */
export interface MetricasReservas {
  confirmadas: number;
  canceladas: number;
  atendidos: number;
  ausentes: number;
  sinRegistrar: number;
}

export interface FilaReporteOcupacion {
  id: string;
  nombre: string;
  especialidad?: string; // solo en las filas por médico
  ocupacion: MetricasOcupacion;
  reservas: MetricasReservas;
}

export interface ResultadoReporteOcupacion {
  ocupacion: MetricasOcupacion;
  reservas: MetricasReservas;
  porMedico: FilaReporteOcupacion[];
  porEspecialidad: FilaReporteOcupacion[];
  periodo: { desde: string; hasta: string };
}

// US-SIG-036 — Reporte de inventario actual y evolución
// ---------------------------------------------------------------------------

export type TipoMovimientoReporte = "COMPRA" | "APLICACION" | "AJUSTE";

export interface FiltrosReporteInventario {
  desde: string; // Formato YYYY-MM-DD
  hasta: string; // Formato YYYY-MM-DD
  vacunaId?: string;
  loteId?: string;
  /** Solo afecta al detalle de movimientos, no al resumen del período. */
  tipo?: TipoMovimientoReporte;
}

export interface LoteStockReporte {
  id: string;
  codigo: string;
  fechaVencimiento: string; // YYYY-MM-DD
  fisico: number;
}

export interface VacunaStockReporte {
  id: string;
  nombre: string;
  activa: boolean;
  umbralMinimo: number;
  fisico: number;
  bajoUmbral: boolean;
  lotes: LoteStockReporte[];
}

export interface ResumenInventarioReporte {
  vacunaId: string;
  vacuna: string;
  loteId: string;
  lote: string;
  saldoInicial: number;
  entradas: number;
  ajustes: number;
  saldoFinal: number;
}

export interface MovimientoInventarioReporte {
  id: string;
  fecha: string; // ISO
  vacuna: string;
  lote: string;
  tipo: TipoMovimientoReporte;
  cantidad: number; // firmada
  motivo: string | null;
  operador: string;
}

export interface ResultadoReporteInventario {
  stockActual: VacunaStockReporte[];
  resumen: ResumenInventarioReporte[];
  movimientos: MovimientoInventarioReporte[];
  totalMovimientos: number;
  periodo: {
    desde: string;
    hasta: string;
  };
  filtrosAplicados: {
    vacunaId: string | null;
    loteId: string | null;
    tipo: TipoMovimientoReporte | null;
  };
}

export interface OpcionLoteInventario {
  id: string;
  codigo: string;
}

export interface OpcionVacunaInventario {
  id: string;
  nombre: string;
  lotes: OpcionLoteInventario[];
}
