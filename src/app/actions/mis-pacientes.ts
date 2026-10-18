"use server";

import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/guards";

export type MiPaciente = {
  personaId: string;
  nombreCompleto: string;
  dni: string;
  esTitular: boolean;
};

export async function obtenerMisPacientes(): Promise<MiPaciente[]> {
  const sesion = await requireRole("PACIENTE");

  // El paciente se identifica por la persona de la cuenta, no por el id del
  // usuario (son ids distintos).
  const usuario = await prisma.usuario.findUnique({
    where: { id: BigInt(sesion.usuarioId) },
    select: { personaId: true },
  });
  if (!usuario) return [];

  // 1. Buscar paciente titular vinculado a este usuario
  const pacienteTitular = await prisma.paciente.findUnique({
    where: { personaId: usuario.personaId },
    select: {
      personaId: true,
      dni: true,
      persona: { select: { nombreCompleto: true } },
    },
  });

  const resultado: MiPaciente[] = [];

  if (pacienteTitular) {
    resultado.push({
      personaId: pacienteTitular.personaId.toString(),
      nombreCompleto: pacienteTitular.persona.nombreCompleto,
      dni: pacienteTitular.dni,
      esTitular: true,
    });

    // 2. Buscar menores tutelados por este paciente
    const menores = await prisma.paciente.findMany({
      where: { tutorId: pacienteTitular.personaId },
      select: {
        personaId: true,
        dni: true,
        persona: { select: { nombreCompleto: true } },
      },
      orderBy: { persona: { nombreCompleto: "asc" } },
    });

    for (const m of menores) {
      resultado.push({
        personaId: m.personaId.toString(),
        nombreCompleto: m.persona.nombreCompleto,
        dni: m.dni,
        esTitular: false,
      });
    }
  }

  return resultado;
}
