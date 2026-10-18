import { prisma } from "@/lib/db/prisma";

export interface RegistrarConsultaInput {
  turnoId: string;
  diagnostico: string;
  sintomas?: string;
  indicaciones?: string;
  medicacion?: string;
  estudios?: string;
  observaciones?: string;
  certificado?: string;
}

export type ResultadoRegistroConsulta =
  | { exito: true; consultaId: string; mensaje: string }
  | { exito: false; error: string };

export interface ConsultaClinicaViewData {
  turnoId: string;
  autorId: string;
  autorNombre: string;
  diagnostico: string;
  sintomas: string | null;
  indicaciones: string | null;
  medicacion: string | null;
  estudios: string | null;
  observaciones: string | null;
  certificado: string | null;
  creadaEn: string; // ISO 8601
}

/**
 * Obtiene la consulta clínica de un turno para el médico autor (CA4 / CA5).
 * Si la consulta pertenece a otro profesional, no se devuelve (CA5: confidencialidad clínica).
 */
export async function obtenerConsultaClinicaTurno({
  turnoId,
  medicoUsuarioId,
}: {
  turnoId: string;
  medicoUsuarioId: string;
}): Promise<ConsultaClinicaViewData | null> {
  let turnoIdBig: bigint;
  try {
    turnoIdBig = BigInt(turnoId);
  } catch {
    return null;
  }

  const consulta = await prisma.consulta.findUnique({
    where: { turnoId: turnoIdBig },
    include: {
      autor: {
        include: {
          usuario: {
            include: {
              persona: true,
            },
          },
        },
      },
    },
  });

  if (!consulta) return null;

  // CA5: El médico no puede consultar notas de otros profesionales.
  if (consulta.autorId.toString() !== medicoUsuarioId) {
    return null;
  }

  return {
    turnoId: consulta.turnoId.toString(),
    autorId: consulta.autorId.toString(),
    autorNombre: consulta.autor.usuario.persona.nombreCompleto,
    diagnostico: consulta.diagnostico,
    sintomas: consulta.sintomas,
    indicaciones: consulta.indicaciones,
    medicacion: consulta.medicacion,
    estudios: consulta.estudios,
    observaciones: consulta.observaciones,
    certificado: consulta.certificado,
    creadaEn: consulta.creadaEn.toISOString(),
  };
}
