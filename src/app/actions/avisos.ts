"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/auth/guards";
import { AUDITORIA, INICIO_POR_ROL, MSG } from "@/lib/auth/constants";

export type ResultadoMarcarLeido =
  { exito: true; mensaje: string } | { exito: false; error: string };

/**
 * Marca un aviso individual como leído.
 * Verifica que el aviso pertenece al usuario autenticado (CA2).
 */
export async function marcarAvisoLeidoAction(
  avisoId: string,
): Promise<ResultadoMarcarLeido> {
  // 1. Sesión — cualquier rol
  const sesion = await requireSession();
  // 2. Validar BigInt
  let id: bigint;
  try {
    id = BigInt(avisoId);
  } catch {
    return { exito: false, error: MSG.AVISOS_NO_ENCONTRADO };
  }
  // 3. Verificar que el aviso existe Y pertenece al usuario (CA2)
  const aviso = await prisma.avisoInterno.findFirst({
    where: { id, usuarioId: BigInt(sesion.usuarioId) },
  });
  if (!aviso) return { exito: false, error: MSG.AVISOS_NO_ENCONTRADO };
  // 4. Idempotente: si ya está leído, retornar ok
  if (aviso.leido) return { exito: true, mensaje: MSG.AVISOS_YA_LEIDO };
  // 5. Actualizar
  await prisma.avisoInterno.update({ where: { id }, data: { leido: true } });
  // 6. Revalidar la página de avisos del rol
  revalidatePath(INICIO_POR_ROL[sesion.rol] + "/avisos");
  return { exito: true, mensaje: MSG.AVISOS_MARCADO_LEIDO };
}

/**
 * Marca todos los avisos no leídos del usuario como leídos.
 * Registra auditoría con la cantidad afectada.
 */
export async function marcarTodosLeidosAction(): Promise<ResultadoMarcarLeido> {
  const sesion = await requireSession();
  const usuarioId = BigInt(sesion.usuarioId);

  const { count } = await prisma.$transaction(async (tx) => {
    const r = await tx.avisoInterno.updateMany({
      where: { usuarioId, leido: false },
      data: { leido: true },
    });
    if (r.count > 0) {
      await tx.auditoria.create({
        data: {
          actorId: usuarioId,
          accion: AUDITORIA.MARCAR_AVISOS_LEIDOS,
          entidad: "aviso_interno",
          detalle: `${r.count} aviso(s) marcados como leídos`,
        },
      });
    }
    return r;
  });

  revalidatePath(INICIO_POR_ROL[sesion.rol] + "/avisos");
  return {
    exito: true,
    mensaje: count > 0 ? MSG.AVISOS_TODOS_LEIDOS : MSG.AVISOS_SIN_PENDIENTES,
  };
}
