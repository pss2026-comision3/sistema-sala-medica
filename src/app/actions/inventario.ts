"use server";
 
import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
 
import { Prisma } from "@/generated/prisma/client";
import { esFechaValida, hoySala } from "@/lib/agenda/reglas";
import { AUDITORIA } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import {
  compromisosVacuna,
  fisicoVacuna,
  saldoLote,
} from "@/lib/vacunacion/inventario";
import {
  MSG_INVENTARIO,
  cantidadConSigno,
  componerMotivoCorreccion,
  evaluarMovimientoStock,
} from "@/lib/vacunacion/inventario-reglas";
import { evaluarYNotificarStockBajo } from "@/lib/vacunacion/notificaciones-stock";
import { esquemaMovimientoInventario } from "@/lib/validations/inventario";
 
/*
 * US-SIG-026 — Registrar entradas y ajustes de inventario (RF-03).
 *
 * CA1: la compra exige vacuna, lote, cantidad entera positiva y referencia.
 *      La carga inicial de un lote se registra como ajuste positivo.
 * CA2: el ajuste exige variación entera distinta de 0 y motivo. Fecha y
 *      operador los asigna el sistema (`creado_en`, `registrado_por`).
 * CA3: ningún lote queda negativo y el físico de la vacuna no queda por
 *      debajo de sus compromisos. Se valida con la vacuna bloqueada.
 * CA4: este formulario no crea bajas por aplicación (las crea US-025).
 * CA5: los movimientos no se editan ni borran; una corrección es un ajuste
 *      nuevo que identifica al movimiento corregido.
 */
 
export type ResultadoMovimiento =
  | {
      exito: true;
      mensaje: string;
      movimientoId: string;
      saldoLote: number;
      fisicoVacuna: number;
    }
  | { error: string };
 
/** Error de negocio que se muestra tal cual a Enfermería. */
class ErrorInventario extends Error {}
 
function mensajeValidacion(error: ZodError): string {
  return error.issues[0]?.message ?? MSG_INVENTARIO.ERROR_INTERNO;
}
 
export async function registrarMovimientoInventario(
  input: unknown,
): Promise<ResultadoMovimiento> {
  const sesion = await requireRole("ENFERMERIA");
  const operadorId = BigInt(sesion.usuarioId);
 
  const validacion = esquemaMovimientoInventario.safeParse(input);
  if (!validacion.success) {
    return { error: mensajeValidacion(validacion.error) };
  }
  const datos = validacion.data;
 
  const ahora = new Date();
  if (datos.lote.modo === "nuevo") {
    if (!esFechaValida(datos.lote.fechaVencimiento)) {
      return { error: MSG_INVENTARIO.LOTE_VENCIMIENTO_INVALIDO };
    }
    if (datos.lote.fechaVencimiento <= hoySala(ahora)) {
      return { error: MSG_INVENTARIO.LOTE_VENCIMIENTO_PASADO };
    }
  }
 
  const vacunaId = BigInt(datos.vacunaId);
 
  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Bloquea la vacuna: dos movimientos simultáneos sobre sus lotes (o
      //    una aplicación de US-025, que debe tomar el mismo lock) se
      //    serializan y cada uno valida el saldo real (CA3).
      const vacunas = await tx.$queryRaw<{ nombre: string; activa: boolean }[]>`
        SELECT "nombre", "activa"
        FROM "vacuna"
        WHERE "id" = ${vacunaId}
        FOR UPDATE`;
      const vacuna = vacunas[0];
      if (!vacuna)
        throw new ErrorInventario(MSG_INVENTARIO.VACUNA_NO_ENCONTRADA);
      if (!vacuna.activa)
        throw new ErrorInventario(MSG_INVENTARIO.VACUNA_INACTIVA);
 
      // 2. Lote: uno existente de esta vacuna o uno nuevo (CA1).
      let lote: { id: bigint; codigo: string };
      let loteCreado = false;
      if (datos.lote.modo === "existente") {
        const existente = await tx.loteVacuna.findFirst({
          where: { id: BigInt(datos.lote.loteId), vacunaId },
          select: { id: true, codigo: true },
        });
        if (!existente) {
          throw new ErrorInventario(MSG_INVENTARIO.LOTE_NO_ENCONTRADO);
        }
        lote = existente;
      } else {
        const repetido = await tx.loteVacuna.findFirst({
          where: {
            codigo: { equals: datos.lote.codigo, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (repetido) {
          throw new ErrorInventario(MSG_INVENTARIO.LOTE_CODIGO_DUPLICADO);
        }
        lote = await tx.loteVacuna.create({
          data: {
            vacunaId,
            codigo: datos.lote.codigo,
            fechaVencimiento: new Date(
              `${datos.lote.fechaVencimiento}T00:00:00.000Z`,
            ),
            utilizable: true,
          },
          select: { id: true, codigo: true },
        });
        loteCreado = true;
      }
 
      // 3. CA5: el ajuste puede identificar el movimiento que compensa.
      let motivo = datos.texto;
      if (datos.corrigeMovimientoId) {
        const corregido = await tx.movimientoStock.findUnique({
          where: { id: BigInt(datos.corrigeMovimientoId) },
          select: { loteId: true, tipo: true },
        });
        if (!corregido || corregido.loteId !== lote.id) {
          throw new ErrorInventario(MSG_INVENTARIO.CORRECCION_NO_ENCONTRADA);
        }
        if (corregido.tipo === "APLICACION") {
          throw new ErrorInventario(MSG_INVENTARIO.CORRECCION_APLICACION);
        }
        motivo = componerMotivoCorreccion(datos.corrigeMovimientoId, motivo);
      }
 
      // 4. CA3: saldos con la vacuna ya bloqueada.
      // Secuencial: la transacción interactiva usa una única conexión.
      const saldoActual = await saldoLote(tx, lote.id);
      const fisicoActual = await fisicoVacuna(tx, vacunaId);
      const compromisos = await compromisosVacuna(tx, vacunaId, ahora);
      const evaluacion = evaluarMovimientoStock({
        codigoLote: lote.codigo,
        saldoLote: saldoActual,
        fisicoVacuna: fisicoActual,
        compromisos,
        cantidad: datos.cantidad,
      });
      if (!evaluacion.ok) throw new ErrorInventario(evaluacion.error);
 
      // 5. El movimiento: fecha y operador los asigna el sistema (CA2).
      const movimiento = await tx.movimientoStock.create({
        data: {
          loteId: lote.id,
          registradoPor: operadorId,
          tipo: datos.tipo,
          cantidad: datos.cantidad,
          motivo,
        },
        select: { id: true },
      });
 
      // 6. Bitácora (RF-21).
      if (loteCreado) {
        await tx.auditoria.create({
          data: {
            actorId: operadorId,
            accion: AUDITORIA.INVENTARIO_ALTA_LOTE,
            entidad: "lote_vacuna",
            referenciaId: lote.id,
            detalle: JSON.stringify({
              vacunaId: vacunaId.toString(),
              codigo: lote.codigo,
            }),
          },
        });
      }
      await tx.auditoria.create({
        data: {
          actorId: operadorId,
          accion:
            datos.tipo === "COMPRA"
              ? AUDITORIA.INVENTARIO_COMPRA
              : AUDITORIA.INVENTARIO_AJUSTE,
          entidad: "movimiento_stock",
          referenciaId: movimiento.id,
          detalle: JSON.stringify({
            vacunaId: vacunaId.toString(),
            loteId: lote.id.toString(),
            cantidad: datos.cantidad,
            saldoLotePosterior: evaluacion.saldoLote,
            corrigeMovimientoId: datos.corrigeMovimientoId ?? null,
          }),
        },
      });
 
      return {
        movimientoId: movimiento.id,
        vacuna: vacuna.nombre,
        codigoLote: lote.codigo,
        saldoLote: evaluacion.saldoLote,
        fisicoVacuna: evaluacion.fisicoVacuna,
      };
    });
 
    revalidatePath("/enfermeria/inventario");
    revalidatePath("/enfermeria/vacunas");

    // CA2 (disparador: movimiento de inventario 026): evalúa el umbral después
    // del movimiento. Los emails se disparan fire-and-forget post-commit, así
    // que un fallo de mail no revierte el movimiento ya confirmado.
    void evaluarYNotificarStockBajo(vacunaId, operadorId);

    return {
      exito: true,
      movimientoId: resultado.movimientoId.toString(),
      saldoLote: resultado.saldoLote,
      fisicoVacuna: resultado.fisicoVacuna,
      mensaje:
        `${datos.tipo === "COMPRA" ? "Entrada por compra registrada" : "Ajuste registrado"} ` +
        `(movimiento #${resultado.movimientoId}): ${cantidadConSigno(datos.cantidad)} ` +
        `dosis en el lote ${resultado.codigoLote}. Saldo del lote: ` +
        `${resultado.saldoLote}. Stock físico de ${resultado.vacuna}: ` +
        `${resultado.fisicoVacuna}.`,
    };
  } catch (error) {
    if (error instanceof ErrorInventario) return { error: error.message };
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Otro registro creó el mismo código de lote en paralelo.
      return { error: MSG_INVENTARIO.LOTE_CODIGO_DUPLICADO };
    }
    console.error("Error registrando movimiento de inventario:", error);
    return { error: MSG_INVENTARIO.ERROR_INTERNO };
  }
}