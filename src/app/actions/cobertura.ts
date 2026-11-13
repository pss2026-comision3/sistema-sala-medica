"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { AUDITORIA, MSG } from "@/lib/auth/constants";
import { requireAlgunRol } from "@/lib/auth/guards";
import { validarAfiliacion } from "@/lib/pacientes/cobertura";
import { cargarBeneficiarios } from "@/lib/turnos/buscar-horarios";

export type EstadoCobertura = { error?: string; mensaje?: string };

/**
 * US-028 CA1/CA2: el titular o tutor selecciona, actualiza o retira la
 * cobertura de un beneficiario; el Administrador lo hace por solicitud
 * presencial. Médico y Enfermería no administran la afiliación.
 */
export async function actualizarCobertura(
  _prev: EstadoCobertura,
  formData: FormData,
): Promise<EstadoCobertura> {
  const sesion = await requireAlgunRol("PACIENTE", "ADMIN");
  const leer = (clave: string) => String(formData.get(clave) ?? "").trim();

  let pacienteId: bigint;
  try {
    pacienteId = BigInt(leer("pacienteId"));
  } catch {
    return { error: MSG.COBERTURA_NO_PERMITIDA };
  }

  if (sesion.rol === "PACIENTE") {
    const beneficiarios = await cargarBeneficiarios(BigInt(sesion.usuarioId));
    if (!beneficiarios.some((b) => b.id === pacienteId.toString())) {
      return { error: MSG.COBERTURA_NO_PERMITIDA };
    }
  } else {
    const existe = await prisma.paciente.findUnique({
      where: { personaId: pacienteId },
      select: { personaId: true },
    });
    if (!existe) return { error: MSG.COBERTURA_NO_PERMITIDA };
  }

  const afiliacion = await validarAfiliacion(prisma, {
    obraSocialId: leer("obraSocialId"),
    plan: leer("plan"),
    numeroAfiliado: leer("numeroAfiliado"),
  });
  if ("error" in afiliacion) return { error: afiliacion.error };

  await prisma.$transaction([
    prisma.paciente.update({
      where: { personaId: pacienteId },
      data: afiliacion,
    }),
    prisma.auditoria.create({
      data: {
        actorId: BigInt(sesion.usuarioId),
        accion: AUDITORIA.COBERTURA_PACIENTE,
        entidad: "paciente",
        referenciaId: pacienteId,
        detalle: JSON.stringify({
          obraSocialId: afiliacion.obraSocialId?.toString() ?? null,
          rolActor: sesion.rol,
        }),
      },
    }),
  ]);

  revalidatePath("/paciente/cobertura");
  revalidatePath("/admin/pacientes");
  return {
    mensaje:
      afiliacion.obraSocialId === null
        ? MSG.COBERTURA_RETIRADA
        : MSG.COBERTURA_ACTUALIZADA,
  };
}
