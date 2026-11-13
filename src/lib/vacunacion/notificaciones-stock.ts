/**
 * US-SIG-027 — Notificaciones de stock bajo a Enfermería.
 *
 * Orquesta la evaluación del umbral y el envío de avisos (interno + email) a
 * las cuentas activas de Enfermería, sin incluir pacientes ni datos de sus
 * reservas (CA5). Los emails se disparan fire-and-forget DESPUÉS del commit
 * de la transacción, para que un fallo de mail nunca revierta la operación
 * original.
 */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { ResultadoEmail } from "@/lib/email/enviar-aviso";
import { enviarAvisoEmail } from "@/lib/email/enviar-aviso";
import { emailAlertaStock, type DatosAlertaStock } from "@/lib/email/templates";
import {
  abrirEpisodio,
  cerrarEpisodio,
  episodioAbierto,
  obtenerEstadoStockVacuna,
  type EstadoStockVacuna,
} from "@/lib/vacunacion/alerta-stock";
import type { Db } from "@/lib/vacunacion/inventario";

const EVENTO_STOCK_BAJO = "Stock bajo de vacuna";

export type DestinatarioEnfermeria = {
  id: bigint;
  email: string;
  nombreCompleto: string;
};

/**
 * Cuentas activas de Enfermería (CA3: solo ellas reciben el aviso).
 */
export async function obtenerDestinatariosEnfermeriaActivas(
  db: Db = prisma,
): Promise<DestinatarioEnfermeria[]> {
  const usuarios = await db.usuario.findMany({
    where: { rol: "ENFERMERIA", activo: true },
    select: { id: true, email: true, persona: { select: { nombreCompleto: true } } },
    orderBy: { email: "asc" },
  });

  return usuarios.map(
    (u: { id: bigint; email: string; persona: { nombreCompleto: string | null } | null }) => ({
      id: u.id,
      email: u.email,
      nombreCompleto: u.persona?.nombreCompleto ?? u.email,
    }),
  );
}

/**
 * Escribe un aviso interno en la bandeja de cada destinatario de Enfermería.
 */
export async function crearAvisosInternosStockBajo(
  tx: Prisma.TransactionClient,
  vacunaId: bigint,
  estado: EstadoStockVacuna,
  destinatarios: DestinatarioEnfermeria[],
): Promise<void> {
  const resumen =
    `Stock bajo de "${estado.nombre}": ${estado.disponibles} dosis disponibles ` +
    `(umbral ${estado.umbralMinimo}). Físicas: ${estado.fisico}, ` +
    `comprometidas: ${estado.compromisos}.`;

  await Promise.all(
    destinatarios.map((d) =>
      tx.avisoInterno.create({
        data: {
          usuarioId: d.id,
          turnoId: null,
          evento: EVENTO_STOCK_BAJO,
          resumen,
          leido: false,
        },
      }),
    ),
  );
}

/**
 * Dispara los emails de alerta de stock bajo (fire-and-forget).
 *
 * `verificarVigencia` confirma que el episodio aún esté abierto antes de cada
 * intento; `registrarResultado` guarda el intento en `IntentoEmail` vinculado
 * al `EventoEmail` del episodio.
 */
export function dispararEmailsStockBajo(
  eventoId: bigint,
  estado: EstadoStockVacuna,
  destinatarios: DestinatarioEnfermeria[],
): void {
  const datos: DatosAlertaStock = {
    vacuna: estado.nombre,
    fisico: estado.fisico,
    compromisos: estado.compromisos,
    disponibles: estado.disponibles,
    umbral: estado.umbralMinimo,
  };
  const mensaje = emailAlertaStock(datos);

  for (const d of destinatarios) {
    enviarAvisoEmail({
      destinatario: d.email,
      mensaje,
      verificarVigencia: async () => {
        const evento = await prisma.eventoEmail.findFirst({
          where: {
            id: eventoId,
            tipoEvento: "ALERTA_STOCK",
            canceladoEn: null,
          },
          select: { id: true },
        });
        return evento ? { destinatario: d.email } : null;
      },
      registrarResultado: async (r: ResultadoEmail) => {
        let resultado: "EXITO" | "FALLIDO";
        if (r.estado === "ENVIADO") {
          resultado = "EXITO";
        } else {
          // FALLIDO y OMITIDO se registran como fallo del intento.
          resultado = "FALLIDO";
        }
        await prisma.intentoEmail.create({
          data: {
            eventoId,
            numero: r.intento,
            resultado,
            error: r.error ?? null,
            intentadoEn: new Date(),
          },
        });
      },
    });
  }
}

/**
 * Evalúa el stock de la vacuna contra su umbral y notifica si corresponde.
 *
 * - Si disponible <= umbral y no hay episodio abierto: abre episodio, crea
 *   avisos internos y dispara emails a Enfermería.
 * - Si disponible > umbral y hay episodio abierto: cierra el episodio (CA4).
 *
 * Devuelve el estado evaluado y si se abrió/notificó un nuevo episodio.
 */
export async function evaluarYNotificarStockBajo(
  vacunaId: bigint,
  disparadorId: bigint,
): Promise<{
  estado: EstadoStockVacuna;
  episodioAbierto: boolean;
  notificado: boolean;
}> {
  const estado = await obtenerEstadoStockVacuna(vacunaId);
  if (!estado) {
    throw new Error(`Vacuna ${vacunaId.toString()} no encontrada`);
  }

  let eventoId: bigint | null = null;
  let notificado = false;

  const destinatarios = await obtenerDestinatariosEnfermeriaActivas();

  await prisma.$transaction(async (tx) => {
    if (estado.estado === "BAJO") {
      const yaAbierto = await episodioAbierto(tx, vacunaId);
      if (!yaAbierto) {
        const abierto = await abrirEpisodio(tx, vacunaId, {
          disparadorId,
          asunto: `Alerta de stock bajo: ${estado.nombre}`,
          cuerpo: `Stock bajo alcanzado para ${estado.nombre}.`,
        });
        eventoId = abierto.eventoId;
        notificado = abierto.creado;
      }

      // Solo creamos avisos internos cuando se abre un nuevo episodio.
      // Si ya había uno abierto, el aviso interno ya existe del episodio previo.
      if (notificado) {
        await crearAvisosInternosStockBajo(tx, vacunaId, estado, destinatarios);
      }
    } else {
      const yaAbierto = await episodioAbierto(tx, vacunaId);
      if (yaAbierto) {
        await cerrarEpisodio(tx, vacunaId);
      }
    }
  });

  // Emails fire-and-forget después del commit. Un fallo de mail no revierte
  // nada de lo ya confirmado.
  if (estado.estado === "BAJO" && notificado && eventoId) {
    dispararEmailsStockBajo(eventoId, estado, destinatarios);
  }

  return {
    estado,
    episodioAbierto: estado.estado === "BAJO",
    notificado,
  };
}
