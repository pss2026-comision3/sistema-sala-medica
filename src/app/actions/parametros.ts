"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { AUDITORIA, MSG } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/guards";

export type ResultadoParametros = {
  error?: string;
  exito?: boolean;
  mensaje?: string;
};

export async function actualizarConfiguracionMedico(input: {
  medicoUsuarioId: string;
  duracionMin: number;
  arancel: number;
}): Promise<ResultadoParametros> {
  const sesionAdmin = await requireRole("ADMIN");

  const { medicoUsuarioId, duracionMin, arancel } = input;

  if (
    typeof duracionMin !== "number" ||
    isNaN(duracionMin) ||
    !Number.isInteger(duracionMin) ||
    duracionMin <= 0
  ) {
    return { error: MSG.DURACION_INVALIDA };
  }

  if (typeof arancel !== "number" || isNaN(arancel) || arancel < 0) {
    return { error: MSG.ARANCEL_INVALIDO };
  }

  // Comprobar que no tenga más de dos decimales
  const arancelRedondeado = Math.round(arancel * 100) / 100;
  if (Math.abs(arancel - arancelRedondeado) > 0.00001) {
    return { error: MSG.ARANCEL_DECIMALES };
  }

  let usuarioIdBigInt: bigint;
  try {
    usuarioIdBigInt = BigInt(medicoUsuarioId);
  } catch {
    return { error: MSG.MEDICO_NO_ENCONTRADO };
  }

  const medico = await prisma.medico.findUnique({
    where: { usuarioId: usuarioIdBigInt },
    include: { usuario: true },
  });

  if (!medico || !medico.usuario.activo) {
    return { error: MSG.MEDICO_NO_ENCONTRADO };
  }

  const duracionAnterior = medico.duracionTurnoMin;
  const arancelAnterior = Number(medico.arancelActual);

  await prisma.$transaction(async (tx) => {
    await tx.medico.update({
      where: { usuarioId: medico.usuarioId },
      data: {
        duracionTurnoMin: duracionMin,
        arancelActual: arancelRedondeado,
      },
    });

    await tx.auditoria.create({
      data: {
        actorId: BigInt(sesionAdmin.usuarioId),
        accion: AUDITORIA.CONFIGURACION_MEDICO,
        entidad: "medico",
        referenciaId: medico.usuarioId,
        detalle: JSON.stringify({
          duracionAnterior,
          duracionNueva: duracionMin,
          arancelAnterior,
          arancelNuevo: arancelRedondeado,
        }),
      },
    });
  });

  revalidatePath("/admin/parametros");

  return {
    exito: true,
    mensaje: MSG.CONFIGURACION_MEDICO_EXITO,
  };
}

export async function actualizarArancelVacuna(input: {
  vacunaId: string;
  arancel: number;
}): Promise<ResultadoParametros> {
  const sesionAdmin = await requireRole("ADMIN");

  const { vacunaId, arancel } = input;

  if (typeof arancel !== "number" || isNaN(arancel) || arancel < 0) {
    return { error: MSG.ARANCEL_VACUNA_INVALIDO };
  }

  // Comprobar que no tenga más de dos decimales
  const arancelRedondeado = Math.round(arancel * 100) / 100;
  if (Math.abs(arancel - arancelRedondeado) > 0.00001) {
    return { error: MSG.ARANCEL_DECIMALES };
  }

  let vacunaIdBigInt: bigint;
  try {
    vacunaIdBigInt = BigInt(vacunaId);
  } catch {
    return { error: MSG.VACUNA_NO_ENCONTRADA };
  }

  const vacuna = await prisma.vacuna.findUnique({
    where: { id: vacunaIdBigInt },
  });

  if (!vacuna) {
    return { error: MSG.VACUNA_NO_ENCONTRADA };
  }

  const arancelAnterior = Number(vacuna.arancelActual);

  await prisma.$transaction(async (tx) => {
    await tx.vacuna.update({
      where: { id: vacuna.id },
      data: {
        arancelActual: arancelRedondeado,
      },
    });

    await tx.auditoria.create({
      data: {
        actorId: BigInt(sesionAdmin.usuarioId),
        accion: AUDITORIA.CONFIGURACION_VACUNA,
        entidad: "vacuna",
        referenciaId: vacuna.id,
        detalle: JSON.stringify({
          arancelAnterior,
          arancelNuevo: arancelRedondeado,
        }),
      },
    });
  });

  revalidatePath("/admin/parametros");

  return {
    exito: true,
    mensaje: MSG.CONFIGURACION_VACUNA_EXITO,
  };
}
