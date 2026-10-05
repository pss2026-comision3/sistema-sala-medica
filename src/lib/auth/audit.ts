import { prisma } from "@/lib/db/prisma";
import { AUDITORIA } from "@/lib/auth/constants";

type AccionAuditable = (typeof AUDITORIA)[keyof typeof AUDITORIA];

export async function registrarAuditoria(input: {
  actorId: bigint;
  accion: AccionAuditable;
  referenciaId: bigint;
}): Promise<void> {
  try {
    await prisma.auditoria.create({
      data: {
        actorId: input.actorId,
        accion: input.accion,
        entidad: "usuario",
        referenciaId: input.referenciaId,
        detalle: null,
      },
    });
  } catch {
    // La auditoría no debe bloquear el flujo principal.
  }
}
