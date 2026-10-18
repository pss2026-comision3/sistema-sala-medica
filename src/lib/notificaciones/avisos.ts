import type { Prisma } from "@/generated/prisma/client";

/**
 * Superficie compartida de avisos por email de los turnos.
 *
 * Acá solo se dejan **escritas** las filas de `evento_email`; el envío real del
 * correo y la bandeja interna pertenecen a US-031/US-032/US-033. Un evento con
 * `canceladoEn` distinto de null nunca debe enviarse: así el recordatorio
 * pendiente de una cita cancelada (US-014 CA4, US-032 CA2) no se dispara.
 *
 * Expone operaciones que reciben el cliente de transacción para que puedan
 * ejecutarse junto con el cambio de estado del turno, sin dejar efectos
 * parciales si algo falla.
 */

export const ASUNTO_CANCELACION = "SIGSAM - Cancelación de turno";

/**
 * Clave idempotente del aviso de cancelación de un turno. Reintentar la misma
 * operación no multiplica notificaciones (US-031 CA4).
 */
export function claveEventoCancelacion(turnoId: bigint): string {
  return `turno:${turnoId.toString()}:cancelacion`;
}

/**
 * Anula los recordatorios pendientes del turno (US-014 CA4, US-032 CA2).
 * Devuelve cuántos quedaron anulados.
 */
export async function anularRecordatoriosPendientes(
  tx: Prisma.TransactionClient,
  turnoId: bigint,
  ahora: Date,
): Promise<number> {
  const { count } = await tx.eventoEmail.updateMany({
    where: {
      turnoId,
      tipoEvento: "RECORDATORIO",
      canceladoEn: null,
    },
    data: { canceladoEn: ahora },
  });
  return count;
}

/**
 * Escribe el aviso interno/email de cancelación de un turno. El cuerpo incluye
 * solo datos necesarios de la cita (sin diagnóstico ni archivos clínicos,
 * US-031 CA5).
 */
export async function crearAvisoCancelacion(
  tx: Prisma.TransactionClient,
  datos: {
    turnoId: bigint;
    destinatarioId: bigint;
    emailDestino: string;
    cuerpo: string;
    ahora: Date;
  },
): Promise<void> {
  await tx.eventoEmail.create({
    data: {
      destinatarioId: datos.destinatarioId,
      turnoId: datos.turnoId,
      tipoEvento: "CANCELACION",
      claveEvento: claveEventoCancelacion(datos.turnoId),
      emailDestinoSnapshot: datos.emailDestino,
      asunto: ASUNTO_CANCELACION,
      cuerpo: datos.cuerpo,
      programadoEn: datos.ahora,
    },
  });
}
