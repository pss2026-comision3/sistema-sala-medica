/**
 * US-SIG-027 — Umbral y alertas de stock bajo.
 *
 * Lógica de dominio para evaluar el nivel de stock de una vacuna contra su
 * umbral y manejar el episodio de alerta (abierto / cerrado) para no repetir
 * el aviso mientras persista el mismo episodio de nivel bajo (CA4).
 *
 * Nota sobre el episodio: se usa la tabla `EventoEmail` con
 * `claveEvento = "ALERTA_STOCK:<vacunaId>"` como cerrojo idempotente del
 * episodio, evitando una migración de Prisma. El `destinatarioId` del evento
 * es el operador que dispara la evaluación; los envíos reales a todas las
 * cuentas de Enfermería se resuelven por separado (AvisoInterno + email).
 */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  compromisosVacuna,
  fisicoVacuna,
  type Db,
} from "@/lib/vacunacion/inventario";

const CLAVE_EVENTO_PREFIX = "ALERTA_STOCK";

export type EstadoStockVacuna = {
  vacunaId: bigint;
  nombre: string;
  fisico: number;
  compromisos: number;
  disponibles: number;
  umbralMinimo: number;
  activa: boolean;
  /** "BAJO" cuando disponibles <= umbralMinimo. */
  estado: "BAJO" | "OK";
};

function claveEvento(vacunaId: bigint): string {
  return `${CLAVE_EVENTO_PREFIX}:${vacunaId}`;
}

/**
 * Evalúa el estado de stock de una vacuna contra su umbral.
 *
 * Disponible = físico - compromisos. Las dosis ya comprometidas (reservas de
 * vacunación sin aplicar) no pueden ofrecerse nuevamente, por eso se restan.
 * Nivel bajo cuando disponible <= umbral, incluido el caso de cero dosis.
 */
export async function obtenerEstadoStockVacuna(
  vacunaId: bigint,
  db: Db = prisma,
  ahora: Date = new Date(),
): Promise<EstadoStockVacuna | null> {
  const vacuna = await db.vacuna.findUnique({
    where: { id: vacunaId },
    select: { id: true, nombre: true, umbralMinimo: true, activa: true },
  });
  if (!vacuna) return null;

  const [fisico, compromisos] = await Promise.all([
    fisicoVacuna(db, vacunaId),
    compromisosVacuna(db, vacunaId, ahora),
  ]);

  const disponibles = fisico - compromisos;

  return {
    vacunaId: vacuna.id,
    nombre: vacuna.nombre,
    fisico,
    compromisos,
    disponibles,
    umbralMinimo: vacuna.umbralMinimo,
    activa: vacuna.activa,
    estado: disponibles <= vacuna.umbralMinimo ? "BAJO" : "OK",
  };
}

/**
 * Indica si hay un episodio de alerta de stock bajo abierto para la vacuna.
 * Un episodio está abierto cuando existe un EventoEmail de tipo ALERTA_STOCK
 * con la clave del episodio y sin `canceladoEn`.
 */
export async function episodioAbierto(
  tx: Prisma.TransactionClient,
  vacunaId: bigint,
): Promise<boolean> {
  const evento = await tx.eventoEmail.findFirst({
    where: {
      vacunaId,
      tipoEvento: "ALERTA_STOCK",
      claveEvento: claveEvento(vacunaId),
      canceladoEn: null,
    },
    select: { id: true },
  });
  return !!evento;
}

/**
 * Cierra el episodio de alerta abierto de la vacuna (si existe).
 * Se invoca cuando el disponible supera el umbral, quedando habilitada una
 * alerta futura si vuelve a bajar.
 */
export async function cerrarEpisodio(
  tx: Prisma.TransactionClient,
  vacunaId: bigint,
): Promise<void> {
  await tx.eventoEmail.updateMany({
    where: {
      vacunaId,
      tipoEvento: "ALERTA_STOCK",
      claveEvento: claveEvento(vacunaId),
      canceladoEn: null,
    },
    data: { canceladoEn: new Date() },
  });
}

/**
 * Abre un episodio de alerta creando un EventoEmail si no hay uno abierto.
 *
 * Devuelve true si se creó un nuevo episodio; false si ya estaba abierto (el
 * aviso no debe repetirse mientras persista el episodio).
 *
 * @param disparadorId usuario que dispara la evaluación (queda como
 *   destinatario del evento cerrojo).
 */
export async function abrirEpisodio(
  tx: Prisma.TransactionClient,
  vacunaId: bigint,
  datos: {
    disparadorId: bigint;
    asunto: string;
    cuerpo: string;
  },
): Promise<boolean> {
  const yaAbierto = await episodioAbierto(tx, vacunaId);
  if (yaAbierto) return false;

  await tx.eventoEmail.create({
    data: {
      destinatarioId: datos.disparadorId,
      vacunaId,
      tipoEvento: "ALERTA_STOCK",
      claveEvento: claveEvento(vacunaId),
      emailDestinoSnapshot: "",
      asunto: datos.asunto,
      cuerpo: datos.cuerpo,
      programadoEn: new Date(),
    },
  });
  return true;
}
