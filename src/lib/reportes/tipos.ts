/**
 * Contratos de datos y tipos para el módulo de reportes (US-SIG-035).
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
