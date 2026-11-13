import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { MSG } from "@/lib/auth/constants";

type Db = Prisma.TransactionClient | typeof prisma;

export type Modalidad = "PARTICULAR" | "CON_COBERTURA";

/** Cobertura registrada de un paciente, tal como la ve la interfaz. */
export type CoberturaPaciente = {
  obraSocialId: string;
  nombre: string;
  plan: string;
  numeroAfiliado: string;
  /** Una obra social inactiva no admite nuevas reservas con cobertura (CA5). */
  activa: boolean;
} | null;

/** Select de Prisma para leer la cobertura de un `Paciente`. */
export const SELECCION_COBERTURA = {
  plan: true,
  numeroAfiliado: true,
  obraSocial: { select: { id: true, nombre: true, activa: true } },
} as const;

export function coberturaDe(p: {
  plan: string | null;
  numeroAfiliado: string | null;
  obraSocial: { id: bigint; nombre: string; activa: boolean } | null;
}): CoberturaPaciente {
  if (!p.obraSocial || !p.plan || !p.numeroAfiliado) return null;
  return {
    obraSocialId: p.obraSocial.id.toString(),
    nombre: p.obraSocial.nombre,
    plan: p.plan,
    numeroAfiliado: p.numeroAfiliado,
    activa: p.obraSocial.activa,
  };
}

/**
 * US-028 CA1/CA2 (y US-002 CA4): una obra social activa del catálogo con plan
 * y número de afiliado, o «Sin obra social» (los tres campos en null, como
 * exige `paciente_cobertura_coherente_chk`).
 */
export async function validarAfiliacion(
  db: Db,
  input: { obraSocialId: string; plan: string; numeroAfiliado: string },
): Promise<
  | {
      obraSocialId: bigint | null;
      plan: string | null;
      numeroAfiliado: string | null;
    }
  | { error: string }
> {
  if (!input.obraSocialId) {
    return { obraSocialId: null, plan: null, numeroAfiliado: null };
  }
  let idElegido: bigint;
  try {
    idElegido = BigInt(input.obraSocialId);
  } catch {
    return { error: MSG.ALTA_OBRA_SOCIAL_INVALIDA };
  }
  const obraSocial = await db.obraSocial.findUnique({
    where: { id: idElegido },
    select: { activa: true },
  });
  if (!obraSocial || !obraSocial.activa) {
    return { error: MSG.ALTA_OBRA_SOCIAL_INVALIDA };
  }
  if (!input.plan || !input.numeroAfiliado) {
    return { error: MSG.ALTA_AFILIACION_INCOMPLETA };
  }
  if (input.plan.length > 120 || input.numeroAfiliado.length > 80) {
    return { error: MSG.ALTA_AFILIACION_LARGA };
  }
  return {
    obraSocialId: idElegido,
    plan: input.plan,
    numeroAfiliado: input.numeroAfiliado,
  };
}

/**
 * US-028 CA3/CA4: datos de modalidad a guardar en el `Turno`. «Con cobertura»
 * exige afiliación completa y obra social activa, y copia nombre, plan y
 * afiliado para que cambios posteriores no alteren la cita (CA5).
 */
export async function datosModalidad(
  db: Db,
  pacienteId: bigint,
  modalidad: string,
): Promise<
  | {
      modalidad: Modalidad;
      obraSocialId: bigint | null;
      coberturaNombreSnapshot: string | null;
      coberturaPlanSnapshot: string | null;
      afiliadoSnapshot: string | null;
    }
  | { error: string }
> {
  if (modalidad === "PARTICULAR") {
    return {
      modalidad,
      obraSocialId: null,
      coberturaNombreSnapshot: null,
      coberturaPlanSnapshot: null,
      afiliadoSnapshot: null,
    };
  }
  if (modalidad !== "CON_COBERTURA") return { error: MSG.MODALIDAD_INVALIDA };

  const paciente = await db.paciente.findUnique({
    where: { personaId: pacienteId },
    select: SELECCION_COBERTURA,
  });
  const cobertura = paciente ? coberturaDe(paciente) : null;
  if (!cobertura) return { error: MSG.MODALIDAD_SIN_AFILIACION };
  if (!cobertura.activa) return { error: MSG.MODALIDAD_OS_INACTIVA };
  return {
    modalidad,
    obraSocialId: BigInt(cobertura.obraSocialId),
    coberturaNombreSnapshot: cobertura.nombre,
    coberturaPlanSnapshot: cobertura.plan,
    afiliadoSnapshot: cobertura.numeroAfiliado,
  };
}

/** CA4: se informa como registrada, nunca como autorización validada. */
export function etiquetaCobertura(
  modalidad: Modalidad,
  nombreSnapshot: string | null,
): string {
  return modalidad === "CON_COBERTURA"
    ? `Cobertura registrada: ${nombreSnapshot ?? "obra social"}`
    : "Particular";
}
