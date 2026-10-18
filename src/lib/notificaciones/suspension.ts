import type { Prisma } from "@/generated/prisma/client";

import {
  ASUNTO_SUSPENSION,
  claveEventoSuspension,
} from "@/lib/agenda/suspension";

/**
 * US-SIG-009: operaciones sobre `evento_email` al suspender una jornada.
 *
 * `evento_email` funciona como bandeja de salida: cada fila es a la vez el
 * aviso interno del destinatario y el email pendiente de envío. El envío
 * real y la bandeja de avisos son de US-031/US-032/US-033; un evento con
 * `cancelado_en` distinto de null nunca debe enviarse.
 *
 * Todas las funciones reciben el cliente de transacción para ejecutarse junto
 * con el cambio de estado de la jornada (todo o nada).
 */

/**
 * CA5: suspende los recordatorios pendientes de las citas afectadas
 * (US-032 CA2: suspender impide enviar recordatorios pendientes).
 */
export async function suspenderRecordatorios(
  tx: Prisma.TransactionClient,
  turnoIds: bigint[],
  ahora: Date,
): Promise<number> {
  if (turnoIds.length === 0) return 0;
  const { count } = await tx.eventoEmail.updateMany({
    where: {
      turnoId: { in: turnoIds },
      tipoEvento: "RECORDATORIO",
      canceladoEn: null,
    },
    data: { canceladoEn: ahora },
  });
  return count;
}

export type AvisoSuspension = {
  turnoId: bigint;
  destinatarioId: bigint;
  emailDestino: string;
  cuerpo: string;
};

/**
 * CA4: un aviso (email + aviso interno) por cita confirmada afectada. La
 * clave única evita duplicados si la operación se reintenta (US-031 CA4).
 */
export async function crearAvisosSuspension(
  tx: Prisma.TransactionClient,
  avisos: AvisoSuspension[],
  ahora: Date,
): Promise<number> {
  if (avisos.length === 0) return 0;
  const { count } = await tx.eventoEmail.createMany({
    data: avisos.map((aviso) => ({
      destinatarioId: aviso.destinatarioId,
      turnoId: aviso.turnoId,
      tipoEvento: "SUSPENSION" as const,
      claveEvento: claveEventoSuspension(aviso.turnoId),
      emailDestinoSnapshot: aviso.emailDestino,
      asunto: ASUNTO_SUSPENSION,
      cuerpo: aviso.cuerpo,
      programadoEn: ahora,
    })),
    skipDuplicates: true,
  });
  return count;
}
