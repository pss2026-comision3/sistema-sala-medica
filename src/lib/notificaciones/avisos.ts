import type { Prisma } from "@/generated/prisma/client";

/**
 * Superficie compartida de avisos internos de los turnos (US-031).
 *
 * Escribe las notificaciones directamente en la bandeja del usuario (`AvisoInterno`).
 * Expone operaciones que reciben el cliente de transacción (`tx`) para que puedan
 * ejecutarse de forma segura junto con el cambio de estado del turno.
 */

export const EVENTO_CANCELACION = "Cancelación de turno";
export const EVENTO_CONFIRMACION = "Turno confirmado";
export const EVENTO_REPROGRAMACION = "Turno reprogramado";
export const EVENTO_SUSPENSION = "Atención afectada";
export const EVENTO_RECORDATORIO = "Recordatorio de turno";

/**
 * Escribe el aviso interno de recordatorio previo a la cita.
 */
export async function crearAvisoRecordatorio(
  tx: Prisma.TransactionClient,
  datos: {
    turnoId: bigint;
    usuarioId: bigint;
    resumen: string;
  },
): Promise<void> {
  await tx.avisoInterno.create({
    data: {
      usuarioId: datos.usuarioId,
      turnoId: datos.turnoId,
      evento: EVENTO_RECORDATORIO,
      resumen: datos.resumen,
      leido: false,
    },
  });
}

/**
 * Escribe el aviso interno de cancelación de un turno en la bandeja del usuario.
 * El resumen incluye solo datos necesarios de la cita (sin diagnósticos, US-031 CA5).
 */
export async function crearAvisoCancelacion(
  tx: Prisma.TransactionClient,
  datos: {
    turnoId: bigint;
    usuarioId: bigint; // El ID del usuario que va a recibir el aviso en su bandeja
    resumen: string;   // El cuerpo del mensaje
  },
): Promise<void> {
  await tx.avisoInterno.create({
    data: {
      usuarioId: datos.usuarioId,
      turnoId: datos.turnoId,
      evento: EVENTO_CANCELACION,
      resumen: datos.resumen,
      leido: false,
    },
  });
}

/**
 * Escribe el aviso interno de confirmación de un turno.
 */
export async function crearAvisoConfirmacion(
  tx: Prisma.TransactionClient,
  datos: {
    turnoId: bigint;
    usuarioId: bigint;
    resumen: string;
  },
): Promise<void> {
  await tx.avisoInterno.create({
    data: {
      usuarioId: datos.usuarioId,
      turnoId: datos.turnoId,
      evento: EVENTO_CONFIRMACION,
      resumen: datos.resumen,
      leido: false,
    },
  });
}

/**
 * Escribe el aviso interno cuando se suspende una jornada médica (CA2).
 */
export async function crearAvisoSuspension(
  tx: Prisma.TransactionClient,
  datos: {
    turnoId: bigint;
    usuarioId: bigint;
    resumen: string;
  },
): Promise<void> {
  await tx.avisoInterno.create({
    data: {
      usuarioId: datos.usuarioId,
      turnoId: datos.turnoId,
      evento: EVENTO_SUSPENSION,
      resumen: datos.resumen,
      leido: false,
    },
  });
}

/**
 * Escribe el aviso interno de una reprogramación conjunta (CA3).
 */
export async function crearAvisoReprogramacion(
  tx: Prisma.TransactionClient,
  datos: {
    turnoId: bigint;
    usuarioId: bigint;
    resumen: string;
  },
): Promise<void> {
  await tx.avisoInterno.create({
    data: {
      usuarioId: datos.usuarioId,
      turnoId: datos.turnoId,
      evento: EVENTO_REPROGRAMACION,
      resumen: datos.resumen,
      leido: false,
    },
  });
}

// (Podés agregar funciones similares acá para suspensión o reprogramación 
// a medida que tus compañeros las necesiten).