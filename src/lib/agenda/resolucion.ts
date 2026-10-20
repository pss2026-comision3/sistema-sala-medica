/**
 * US-SIG-015 — Gestionar solicitudes presenciales y reprogramaciones.
 *
 * Reglas puras (sin Prisma ni Next.js) para resolver individualmente una
 * cita confirmada que quedó afectada por la suspensión de su jornada
 * (CA3, CA4, CA6). Mismo estilo que `lib/agenda/suspension.ts`.
 */

export const MSG_RESOLUCION = {
  MOTIVO_REQUERIDO: "Indicá el motivo de la cancelación.",
  MOTIVO_LARGO: "El motivo admite hasta 500 caracteres.",
  CITA_NO_ENCONTRADA: "La cita elegida no existe.",
  CITA_NO_AFECTADA:
    "Esta cita no está pendiente de resolución: no pertenece a una jornada suspendida.",
  CITA_YA_RESUELTA:
    "Esta cita ya se resolvió o ya tiene un resultado registrado.",
  ESPECIALIDAD_DISTINTA:
    "El nuevo horario tiene que ser de la misma especialidad que la cita original.",
  MEDICO_SIN_ESPECIALIDAD:
    "El médico original no tiene especialidad configurada: no se puede reprogramar.",
  JORNADA_DESTINO_NO_PUBLICADA:
    "La jornada elegida para reprogramar no está publicada.",
  SIN_PERMISO: "Tu rol no tiene permiso para resolver esta cita.",
  ERROR_INTERNO: "Ocurrió un error interno al resolver la cita.",
} as const;

export const MOTIVO_MAX = 500;

/** Motivo guardado en `turno.origen_cancelacion` al cancelar con motivo (CA3). */
export const ORIGEN_CANCELACION_RESOLUCION = "resolucion_suspension";
/** Idem para el turno reemplazado por una reprogramación (CA4). */
export const ORIGEN_CANCELACION_REPROGRAMACION = "reprogramacion";

/** Valida el motivo de cancelación (CA3). Devuelve el texto normalizado o un error. */
export function validarMotivoResolucion(
  motivo: unknown,
): { motivo: string } | { error: string } {
  const texto = typeof motivo === "string" ? motivo.trim() : "";
  if (!texto) return { error: MSG_RESOLUCION.MOTIVO_REQUERIDO };
  if (texto.length > MOTIVO_MAX) return { error: MSG_RESOLUCION.MOTIVO_LARGO };
  return { motivo: texto };
}

/**
 * CA3 / CA6: una cita se puede resolver (cancelar o reprogramar) si está
 * confirmada, sin resultado registrado todavía, y su jornada está
 * suspendida. A diferencia de una cancelación común (US-014), no hay límite
 * de 24 hs ni de "antes del inicio": se puede resolver después de su
 * horario, siempre que nadie la haya atendido o marcado ausente.
 */
export function puedeResolverCita(
  turno: {
    estado: "RESERVADO" | "CONFIRMADO" | "CANCELADO";
    resultado: "SIN_REGISTRAR" | "ATENDIDO" | "AUSENTE";
  },
  jornada: { estado: "PUBLICADA" | "SUSPENDIDA" },
): { puede: boolean; motivo: string } {
  // Una cita cancelada ya se resolvió (por ejemplo, desde otra pestaña).
  if (turno.estado === "CANCELADO") {
    return { puede: false, motivo: MSG_RESOLUCION.CITA_YA_RESUELTA };
  }
  if (jornada.estado !== "SUSPENDIDA" || turno.estado !== "CONFIRMADO") {
    return { puede: false, motivo: MSG_RESOLUCION.CITA_NO_AFECTADA };
  }
  if (turno.resultado !== "SIN_REGISTRAR") {
    return { puede: false, motivo: MSG_RESOLUCION.CITA_YA_RESUELTA };
  }
  return { puede: true, motivo: "" };
}

/** CA3: aviso de cancelación administrativa de una cita pendiente de resolución. */
export function cuerpoAvisoCancelacionResolucion(datos: {
  beneficiario: string;
  prestacion: string;
  fechaLegible: string;
  hora: string;
  motivo: string;
}): string {
  return [
    `Administración canceló el turno de ${datos.beneficiario} (${datos.prestacion}, ${datos.fechaLegible} a las ${datos.hora} hs), que había quedado pendiente de resolución por una jornada suspendida.`,
    `Motivo: ${datos.motivo}.`,
  ].join(" ");
}

/** CA4: aviso cuando la resolución fue reprogramar a un nuevo turno. */
export function cuerpoAvisoReprogramacion(datos: {
  beneficiario: string;
  prestacion: string;
  fechaLegible: string;
  hora: string;
  nuevaFechaLegible: string;
  nuevaHora: string;
  nuevoProfesional: string;
}): string {
  return [
    `El turno de ${datos.beneficiario} (${datos.prestacion}, ${datos.fechaLegible} a las ${datos.hora} hs), pendiente de resolución por una jornada suspendida, fue reprogramado.`,
    `Nuevo turno: ${datos.nuevaFechaLegible} a las ${datos.nuevaHora} hs, con ${datos.nuevoProfesional}.`,
  ].join(" ");
}
