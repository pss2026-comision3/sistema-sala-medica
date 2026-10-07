/**
 * Utilidades puras para la gestión de retenciones de turno (US-012).
 * Sin dependencias de Prisma, Next.js ni I/O: solo lógica de negocio testable.
 */

export const RETENCION_MINUTOS = 5;

/**
 * Calcula el instante hasta el cual el cupo queda retenido (ahora + 5 min).
 */
export function calcularRetenidoHasta(ahora: Date = new Date()): Date {
  return new Date(ahora.getTime() + RETENCION_MINUTOS * 60 * 1000);
}

/**
 * Verifica si una retención sigue vigente (no expiró).
 * @param retenidoHasta Instante de expiración de la retención (campo `retenido_hasta`).
 * @param ahora Instante de referencia (por defecto, now).
 * @returns `true` si `retenidoHasta` es futuro respecto a `ahora`.
 */
export function estaRetencionVigente(
  retenidoHasta: Date | null,
  ahora: Date = new Date(),
): boolean {
  if (!retenidoHasta) return false;
  return retenidoHasta > ahora;
}

/**
 * Devuelve el tiempo restante de retención en milisegundos.
 * @returns `0` si ya expiró o es `null`.
 */
export function tiempoRestanteMs(
  retenidoHasta: Date | null,
  ahora: Date = new Date(),
): number {
  if (!retenidoHasta) return 0;
  const diff = retenidoHasta.getTime() - ahora.getTime();
  return diff > 0 ? diff : 0;
}

/**
 * Formatea el tiempo restante como string legible: "3m 42s".
 * @param retenidoHasta Instante de expiración.
 * @param ahora Instante de referencia (por defecto, now).
 */
export function formatearTiempoRestante(
  retenidoHasta: Date | null,
  ahora: Date = new Date(),
): string {
  const ms = tiempoRestanteMs(retenidoHasta, ahora);
  if (ms === 0) return "0s";

  const totalSegundos = Math.ceil(ms / 1000);
  const minutos = Math.floor(totalSegundos / 60);
  const segundos = totalSegundos % 60;

  if (minutos > 0) {
    return `${minutos}m ${segundos}s`;
  }
  return `${segundos}s`;
}

/**
 * Verifica si un turno puede ser confirmado definitivamente.
 * Reglas:
 * - Debe estar en estado RESERVADO
 * - La retención no debe haber expirado
 */
export function puedeConfirmarReserva(
  estado: "RESERVADO" | "CONFIRMADO" | "CANCELADO",
  retenidoHasta: Date | null,
  ahora: Date = new Date(),
): { puede: boolean; motivo?: string } {
  if (estado !== "RESERVADO") {
    return {
      puede: false,
      motivo:
        estado === "CONFIRMADO"
          ? "El turno ya está confirmado."
          : "El turno está cancelado.",
    };
  }
  if (!estaRetencionVigente(retenidoHasta, ahora)) {
    return { puede: false, motivo: "La retención de 5 minutos expiró." };
  }
  return { puede: true };
}

/**
 * Verifica si un cupo (disponibilidad) está libre para reservar.
 * Un cupo está libre si NO existe un turno con esa disponibilidad en estado
 * RESERVADO o CONFIRMADO.
 * (La verificación real se hace en BD con índice único + transacción;
 * esta función es para lógica de UI o validación previa).
 */
export type EstadoTurno = "RESERVADO" | "CONFIRMADO" | "CANCELADO";

export function estaDisponibilidadLibre(
  turnosDeEsaDisponibilidad: Array<{ estado: EstadoTurno }>,
): boolean {
  return !turnosDeEsaDisponibilidad.some(
    (t) => t.estado === "RESERVADO" || t.estado === "CONFIRMADO",
  );
}
