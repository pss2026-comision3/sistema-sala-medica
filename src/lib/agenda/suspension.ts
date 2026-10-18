/**
 * US-SIG-009 — Suspender una jornada médica ante un imprevisto.
 *
 * Textos, constantes y reglas puras (sin Prisma ni Next.js) para que puedan
 * usarse tanto desde las Server Actions como desde los componentes cliente.
 */

export const MSG_SUSPENSION = {
  MOTIVO_REQUERIDO: "Indicá el motivo de la suspensión.",
  MOTIVO_LARGO: "El motivo admite hasta 500 caracteres.",
  CONFIRMACION_REQUERIDA:
    "Confirmá que revisaste los horarios afectados antes de suspender la jornada.",
  JORNADA_NO_ENCONTRADA: "La jornada elegida no existe.",
  JORNADA_AJENA: "Solo podés suspender jornadas propias.",
  JORNADA_YA_SUSPENDIDA:
    "Esa jornada ya está suspendida. Una jornada suspendida no se reabre.",
  JORNADA_PASADA: "Solo se pueden suspender jornadas de hoy o de días futuros.",
  JORNADA_TERMINADA:
    "La jornada de hoy ya terminó; no hay horarios que suspender.",
  MEDICO_NO_ENCONTRADO: "El médico elegido no existe o no está activo.",
  SIN_PERMISO: "Tu rol no tiene permiso para suspender jornadas.",
  ERROR_INTERNO: "Ocurrió un error interno al suspender la jornada.",
} as const;

/** Acción de bitácora (RF-21). */
export const AUDITORIA_SUSPENSION = "Suspensión de jornada médica";

/** Origen guardado en `turno.origen_cancelacion` al liberar una retención. */
export const ORIGEN_CANCELACION_SUSPENSION = "suspension_jornada";

/** Motivo guardado en las retenciones temporales liberadas (CA2). */
export const MOTIVO_RETENCION_LIBERADA =
  "Retención liberada por suspensión de la jornada.";

export const MOTIVO_MAX = 500;

/** Asunto del aviso al paciente (CA4 / US-031 CA2). */
export const ASUNTO_SUSPENSION =
  "SIGSAM - Jornada suspendida: tu turno requiere gestión";

/**
 * Clave idempotente del aviso de suspensión de un turno (US-031 CA4): un
 * reintento de la operación no multiplica notificaciones.
 */
export function claveEventoSuspension(turnoId: bigint | string): string {
  return `turno:${turnoId.toString()}:suspension`;
}

/**
 * Cuerpo del aviso (CA4). Solo datos necesarios de la cita (US-031 CA5):
 * no incluye diagnósticos ni el motivo interno de la suspensión, y NO
 * comunica una cancelación definitiva ni un horario nuevo (US-031 CA2).
 */
export function cuerpoAvisoSuspension(datos: {
  beneficiario: string;
  prestacion: string;
  fechaLegible: string;
  hora: string;
  profesional: string;
}): string {
  return [
    `La jornada de atención de ${datos.profesional} del ${datos.fechaLegible} fue suspendida por un imprevisto.`,
    `El turno de ${datos.beneficiario} (${datos.prestacion}, ${datos.hora} hs) NO está cancelado: requiere gestión.`,
    "Administración se va a comunicar para cancelarlo o acordar un nuevo horario.",
    "Podés ver el estado de la cita en «Mis turnos».",
  ].join(" ");
}

/** Valida el motivo (CA1). Devuelve el texto normalizado o un error. */
export function validarMotivo(
  motivo: unknown,
): { motivo: string } | { error: string } {
  const texto = typeof motivo === "string" ? motivo.trim() : "";
  if (!texto) return { error: MSG_SUSPENSION.MOTIVO_REQUERIDO };
  if (texto.length > MOTIVO_MAX) return { error: MSG_SUSPENSION.MOTIVO_LARGO };
  return { motivo: texto };
}

/**
 * Una jornada se puede suspender si está publicada, es de hoy o futura y, si
 * es de hoy, todavía no terminó. Una jornada suspendida no se reabre ni se
 * vuelve a suspender (inferencia de la US).
 */
export function evaluarSuspensionJornada(
  jornada: {
    estado: "PUBLICADA" | "SUSPENDIDA";
    fecha: string; // YYYY-MM-DD
    finIso: string; // instante de fin de la jornada (inicioTurno(fecha, horaHasta))
  },
  hoy: string,
  ahora: Date = new Date(),
): { puede: boolean; motivo: string } {
  if (jornada.estado === "SUSPENDIDA") {
    return { puede: false, motivo: MSG_SUSPENSION.JORNADA_YA_SUSPENDIDA };
  }
  if (jornada.fecha < hoy) {
    return { puede: false, motivo: MSG_SUSPENSION.JORNADA_PASADA };
  }
  if (new Date(jornada.finIso) <= ahora) {
    return { puede: false, motivo: MSG_SUSPENSION.JORNADA_TERMINADA };
  }
  return { puede: true, motivo: "" };
}
