import type { Prisma, Rol } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { destinatarioDeTurno } from "@/lib/notificaciones/email-turno";

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

/**
 * Escribe el aviso interno de cancelación de un turno en la bandeja del usuario.
 * El resumen incluye solo datos necesarios de la cita (sin diagnósticos, US-031 CA5).
 */
export async function crearAvisoCancelacion(
  tx: Prisma.TransactionClient,
  datos: {
    turnoId: bigint;
    usuarioId: bigint; // El ID del usuario que va a recibir el aviso en su bandeja
    resumen: string; // El cuerpo del mensaje
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

export interface AvisoInternoViewData {
  id: string; // BigInt serializado como string (Next.js no serializa BigInt)
  turnoId: string | null;
  evento: string;
  resumen: string;
  leido: boolean;
  creadoEn: string; // ISO 8601
  enlaceDisponible: boolean; // true si el usuario sigue teniendo acceso al turno vinculado (CA2, CA3)
}

/**
 * Carga la bandeja del usuario con verificación de acceso al enlace (CA2, CA3).
 *
 * Para PACIENTE/MEDICO: verifica acceso al turno via destinatarioDeTurno().
 * Para ADMIN/ENFERMERIA: no generan enlaces (turnoId = null en sus avisos).
 *
 * Serializa BigInt a string antes de retornar (Client Component safe).
 */
export async function obtenerBandejaAvisos({
  usuarioId,
  rol,
}: {
  usuarioId: bigint;
  rol: Rol;
}): Promise<AvisoInternoViewData[]> {
  const avisos = await prisma.avisoInterno.findMany({
    where: { usuarioId },
    orderBy: { creadoEn: "desc" },
  });

  return Promise.all(
    avisos.map(async (a) => {
      let enlaceDisponible = false;
      if (a.turnoId && (rol === "PACIENTE" || rol === "MEDICO")) {
        // CA2, CA3: verificar que el usuario sigue teniendo acceso al turno.
        // destinatarioDeTurno resuelve tutor vigente o paciente activo.
        const dest = await destinatarioDeTurno(
          prisma as unknown as Prisma.TransactionClient,
          a.turnoId,
        );
        enlaceDisponible = dest?.usuarioId === usuarioId;
      }
      return {
        id: a.id.toString(),
        turnoId: a.turnoId?.toString() ?? null,
        evento: a.evento,
        resumen: a.resumen,
        leido: a.leido,
        creadoEn: a.creadoEn.toISOString(),
        enlaceDisponible,
      };
    }),
  );
}

/**
 * Cuenta los avisos no leídos del usuario (para el badge del AppShell).
 */
export async function contarAvisosNoLeidos(usuarioId: bigint): Promise<number> {
  return prisma.avisoInterno.count({
    where: { usuarioId, leido: false },
  });
}
