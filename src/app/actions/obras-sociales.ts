"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { AUDITORIA, MSG } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/guards";
import { registrarAuditoria } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import type { ZodError } from "zod";
import {
  esquemaCrearObraSocial,
  esquemaEditarObraSocial,
  esquemaEstadoObraSocial,
} from "@/lib/validations/obras-sociales";

export type ObraSocialItem = { id: string; nombre: string; activa: boolean };

export type ResultadoObraSocial =
  | { exito: true; mensaje: string; obraSocial: ObraSocialItem }
  | { error: string };

function mensajeValidacion(error: ZodError): string {
  return error.issues[0]?.message ?? MSG.OBRA_SOCIAL_NO_ENCONTRADA;
}

function esErrorPrisma(error: unknown, codigo: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === codigo
  );
}

function revalidarCatalogoYPacientes(): void {
  revalidatePath("/admin/obras-sociales");
  revalidatePath("/admin/pacientes");
}

export async function crearObraSocial(
  input: unknown,
): Promise<ResultadoObraSocial> {
  const sesionAdmin = await requireRole("ADMIN");
  const validacion = esquemaCrearObraSocial.safeParse(input);
  if (!validacion.success) {
    return { error: mensajeValidacion(validacion.error) };
  }

  try {
    const obraSocial = await prisma.obraSocial.create({
      data: { nombre: validacion.data.nombre },
    });

    await registrarAuditoria({
      actorId: BigInt(sesionAdmin.usuarioId),
      accion: AUDITORIA.ALTA_OBRA_SOCIAL,
      entidad: "obra_social",
      referenciaId: obraSocial.id,
      detalle: JSON.stringify({ nombre: obraSocial.nombre }),
    });

    revalidarCatalogoYPacientes();
    return {
      exito: true,
      mensaje: MSG.OBRA_SOCIAL_CREADA,
      obraSocial: {
        id: obraSocial.id.toString(),
        nombre: obraSocial.nombre,
        activa: obraSocial.activa,
      },
    };
  } catch (error) {
    if (esErrorPrisma(error, "P2002")) {
      return { error: MSG.OBRA_SOCIAL_NOMBRE_DUPLICADO };
    }
    throw error;
  }
}

export async function actualizarNombreObraSocial(
  input: unknown,
): Promise<ResultadoObraSocial> {
  const sesionAdmin = await requireRole("ADMIN");
  const validacion = esquemaEditarObraSocial.safeParse(input);
  if (!validacion.success) {
    return { error: mensajeValidacion(validacion.error) };
  }

  const id = BigInt(validacion.data.id);
  const obraSocialAnterior = await prisma.obraSocial.findUnique({
    where: { id },
  });
  if (!obraSocialAnterior) {
    return { error: MSG.OBRA_SOCIAL_NO_ENCONTRADA };
  }

  if (obraSocialAnterior.nombre === validacion.data.nombre) {
    return {
      exito: true,
      mensaje: MSG.OBRA_SOCIAL_NOMBRE_ACTUALIZADO,
      obraSocial: {
        id: obraSocialAnterior.id.toString(),
        nombre: obraSocialAnterior.nombre,
        activa: obraSocialAnterior.activa,
      },
    };
  }

  try {
    const obraSocial = await prisma.obraSocial.update({
      where: { id },
      data: { nombre: validacion.data.nombre },
    });

    await registrarAuditoria({
      actorId: BigInt(sesionAdmin.usuarioId),
      accion: AUDITORIA.EDICION_OBRA_SOCIAL,
      entidad: "obra_social",
      referenciaId: obraSocial.id,
      detalle: JSON.stringify({
        nombreAnterior: obraSocialAnterior.nombre,
        nombreNuevo: obraSocial.nombre,
      }),
    });

    revalidarCatalogoYPacientes();
    return {
      exito: true,
      mensaje: MSG.OBRA_SOCIAL_NOMBRE_ACTUALIZADO,
      obraSocial: {
        id: obraSocial.id.toString(),
        nombre: obraSocial.nombre,
        activa: obraSocial.activa,
      },
    };
  } catch (error) {
    if (esErrorPrisma(error, "P2002")) {
      return { error: MSG.OBRA_SOCIAL_NOMBRE_DUPLICADO };
    }
    if (esErrorPrisma(error, "P2025")) {
      return { error: MSG.OBRA_SOCIAL_NO_ENCONTRADA };
    }
    throw error;
  }
}

export async function cambiarEstadoObraSocial(
  input: unknown,
): Promise<ResultadoObraSocial> {
  const sesionAdmin = await requireRole("ADMIN");
  const validacion = esquemaEstadoObraSocial.safeParse(input);
  if (!validacion.success) {
    return { error: mensajeValidacion(validacion.error) };
  }

  const { id, activa } = validacion.data;
  const idBigInt = BigInt(id);
  const obraSocialAnterior = await prisma.obraSocial.findUnique({
    where: { id: idBigInt },
  });
  if (!obraSocialAnterior) {
    return { error: MSG.OBRA_SOCIAL_NO_ENCONTRADA };
  }

  if (obraSocialAnterior.activa === activa) {
    return {
      exito: true,
      mensaje: MSG.OBRA_SOCIAL_ESTADO_ACTUALIZADO,
      obraSocial: {
        id: obraSocialAnterior.id.toString(),
        nombre: obraSocialAnterior.nombre,
        activa: obraSocialAnterior.activa,
      },
    };
  }

  try {
    const obraSocial = await prisma.obraSocial.update({
      where: { id: idBigInt },
      data: { activa },
    });

    await registrarAuditoria({
      actorId: BigInt(sesionAdmin.usuarioId),
      accion: AUDITORIA.ESTADO_OBRA_SOCIAL,
      entidad: "obra_social",
      referenciaId: obraSocial.id,
      detalle: JSON.stringify({
        nombre: obraSocial.nombre,
        activaAnterior: obraSocialAnterior.activa,
        activaNueva: obraSocial.activa,
      }),
    });

    revalidarCatalogoYPacientes();
    return {
      exito: true,
      mensaje: MSG.OBRA_SOCIAL_ESTADO_ACTUALIZADO,
      obraSocial: {
        id: obraSocial.id.toString(),
        nombre: obraSocial.nombre,
        activa: obraSocial.activa,
      },
    };
  } catch (error) {
    if (esErrorPrisma(error, "P2025")) {
      return { error: MSG.OBRA_SOCIAL_NO_ENCONTRADA };
    }
    throw error;
  }
}
