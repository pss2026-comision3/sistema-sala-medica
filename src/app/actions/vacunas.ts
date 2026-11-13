"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { registrarAuditoria } from "@/lib/auth/audit";
import { AUDITORIA, MSG } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import {
  calcularDosisDisponibles,
  obtenerVacunaConStock,
} from "@/lib/vacunacion/stock";
import type { VacunaStock } from "@/lib/vacunacion/tipos";
import { evaluarYNotificarStockBajo } from "@/lib/vacunacion/notificaciones-stock";
import {
  esquemaCrearVacuna,
  esquemaEditarVacuna,
  esquemaEstadoVacuna,
} from "@/lib/validations/vacunas";

export type ResultadoVacuna =
  | { exito: true; mensaje: string; vacuna: VacunaStock }
  | { error: string };

type ResultadoTransaccion =
  | {
      exito: true;
      mensaje: string;
      activaAnterior: boolean;
      activaNueva: boolean;
      sinCambios: boolean;
    }
  | { error: string };

function mensajeValidacion(error: ZodError): string {
  return error.issues[0]?.message ?? MSG.VACUNA_NO_ENCONTRADA;
}

function esErrorPrisma(error: unknown, codigo: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === codigo
  );
}

function revalidarCatalogo(): void {
  revalidatePath("/enfermeria/vacunas");
  revalidatePath("/enfermeria");
  revalidatePath("/admin/parametros");
}

function revalidarEstado(): void {
  revalidatePath("/enfermeria/vacunas");
  revalidatePath("/enfermeria");
}

export async function crearVacuna(
  input: unknown,
): Promise<ResultadoVacuna> {
  const sesion = await requireRole("ENFERMERIA");
  const validacion = esquemaCrearVacuna.safeParse(input);
  if (!validacion.success) {
    return { error: mensajeValidacion(validacion.error) };
  }

  const { nombre, descripcion, umbralMinimo } = validacion.data;

  try {
    const vacuna = await prisma.vacuna.create({
      data: {
        nombre,
        descripcion,
        umbralMinimo,
        activa: true,
        arancelActual: 0,
      },
    });

    await registrarAuditoria({
      actorId: BigInt(sesion.usuarioId),
      accion: AUDITORIA.ALTA_VACUNA,
      entidad: "vacuna",
      referenciaId: vacuna.id,
      detalle: JSON.stringify({ nombre: vacuna.nombre, umbralMinimo }),
    });

    revalidarCatalogo();

    return {
      exito: true,
      mensaje: MSG.VACUNA_CREADA,
      vacuna: {
        id: vacuna.id.toString(),
        nombre: vacuna.nombre,
        descripcion: vacuna.descripcion,
        umbralMinimo: vacuna.umbralMinimo,
        activa: vacuna.activa,
        dosisDisponibles: 0,
        lotes: [],
      },
    };
  } catch (error) {
    if (esErrorPrisma(error, "P2002")) {
      return { error: MSG.VACUNA_NOMBRE_DUPLICADO };
    }
    throw error;
  }
}

export async function actualizarVacuna(
  input: unknown,
): Promise<ResultadoVacuna> {
  const sesion = await requireRole("ENFERMERIA");
  const validacion = esquemaEditarVacuna.safeParse(input);
  if (!validacion.success) {
    return { error: mensajeValidacion(validacion.error) };
  }

  const { id, nombre, descripcion, umbralMinimo } = validacion.data;
  const idBigInt = BigInt(id);

  const vacunaAnterior = await prisma.vacuna.findUnique({
    where: { id: idBigInt },
  });
  if (!vacunaAnterior) {
    return { error: MSG.VACUNA_NO_ENCONTRADA };
  }

  const sinCambios =
    vacunaAnterior.nombre === nombre &&
    vacunaAnterior.descripcion === descripcion &&
    vacunaAnterior.umbralMinimo === umbralMinimo;

  if (sinCambios) {
    const vacuna = await obtenerVacunaConStock(idBigInt);
    if (!vacuna) {
      return { error: MSG.VACUNA_NO_ENCONTRADA };
    }
    return { exito: true, mensaje: MSG.VACUNA_ACTUALIZADA, vacuna };
  }

  try {
    const vacunaActualizada = await prisma.vacuna.update({
      where: { id: idBigInt },
      data: { nombre, descripcion, umbralMinimo },
    });

    await registrarAuditoria({
      actorId: BigInt(sesion.usuarioId),
      accion: AUDITORIA.EDICION_VACUNA,
      entidad: "vacuna",
      referenciaId: vacunaActualizada.id,
      detalle: JSON.stringify({
        nombreAnterior: vacunaAnterior.nombre,
        nombreNuevo: vacunaActualizada.nombre,
        descripcionAnterior: vacunaAnterior.descripcion,
        descripcionNueva: vacunaActualizada.descripcion,
        umbralAnterior: vacunaAnterior.umbralMinimo,
        umbralNuevo: vacunaActualizada.umbralMinimo,
      }),
    });

    revalidarCatalogo();

    // CA2 (disparador: cambio de umbral): evalúa el umbral después de editar
    // la vacuna. Los emails se disparan fire-and-forget post-commit.
    if (vacunaAnterior.umbralMinimo !== umbralMinimo) {
      void evaluarYNotificarStockBajo(idBigInt, BigInt(sesion.usuarioId));
    }

    const vacuna = await obtenerVacunaConStock(vacunaActualizada.id);
    if (!vacuna) {
      return { error: MSG.VACUNA_NO_ENCONTRADA };
    }

    return { exito: true, mensaje: MSG.VACUNA_ACTUALIZADA, vacuna };
  } catch (error) {
    if (esErrorPrisma(error, "P2002")) {
      return { error: MSG.VACUNA_NOMBRE_DUPLICADO };
    }
    if (esErrorPrisma(error, "P2025")) {
      return { error: MSG.VACUNA_NO_ENCONTRADA };
    }
    throw error;
  }
}

export async function cambiarEstadoVacuna(
  input: unknown,
): Promise<ResultadoVacuna> {
  const sesion = await requireRole("ENFERMERIA");
  const validacion = esquemaEstadoVacuna.safeParse(input);
  if (!validacion.success) {
    return { error: mensajeValidacion(validacion.error) };
  }

  const { id, activa } = validacion.data;
  const idBigInt = BigInt(id);

  let resultado: ResultadoTransaccion;
  try {
    resultado = await prisma.$transaction(
      async (tx) => {
        const vacuna = await tx.vacuna.findUnique({
          where: { id: idBigInt },
          include: {
            lotes: {
              include: {
                movimientos: { select: { cantidad: true } },
              },
            },
          },
        });

        if (!vacuna) {
          return { error: MSG.VACUNA_NO_ENCONTRADA };
        }

        if (vacuna.activa === activa) {
          return {
            exito: true,
            mensaje: activa
              ? MSG.VACUNA_YA_ACTIVA
              : MSG.VACUNA_ESTADO_ACTUALIZADO,
            activaAnterior: vacuna.activa,
            activaNueva: activa,
            sinCambios: true,
          };
        }

        const dosisDisponibles = calcularDosisDisponibles(vacuna.lotes);
        if (!activa && dosisDisponibles !== 0) {
          return {
            error: `${MSG.VACUNA_CON_STOCK} Quedan ${dosisDisponibles} dosis disponibles.`,
          };
        }

        await tx.vacuna.update({
          where: { id: idBigInt },
          data: { activa },
        });

        return {
          exito: true,
          mensaje: MSG.VACUNA_ESTADO_ACTUALIZADO,
          activaAnterior: vacuna.activa,
          activaNueva: activa,
          sinCambios: false,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 15_000,
        timeout: 30_000,
      },
    );
  } catch (error) {
    if (
      esErrorPrisma(error, "P2034") ||
      esErrorPrisma(error, "P2028")
    ) {
      return { error: "No se pudo completar por concurrencia; reintentá." };
    }
    throw error;
  }

  if ("error" in resultado) {
    return resultado;
  }

  if (!resultado.sinCambios) {
    await registrarAuditoria({
      actorId: BigInt(sesion.usuarioId),
      accion: AUDITORIA.ESTADO_VACUNA,
      entidad: "vacuna",
      referenciaId: idBigInt,
      detalle: JSON.stringify({
        activaAnterior: resultado.activaAnterior,
        activaNueva: resultado.activaNueva,
      }),
    });
    revalidarEstado();
  }

  const vacuna = await obtenerVacunaConStock(idBigInt);
  if (!vacuna) {
    return { error: MSG.VACUNA_NO_ENCONTRADA };
  }

  return { exito: true, mensaje: resultado.mensaje, vacuna };
}
