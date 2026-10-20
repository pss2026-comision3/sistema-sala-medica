import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AUDITORIA } from "@/lib/auth/constants";
import {
  evaluarHabilitacionPaciente,
  ocupaCupo,
  type Intervalo,
} from "@/lib/agenda/presencial";
import { hoySala } from "@/lib/agenda/reglas";

/*
 * US-SIG-015 — datos que necesitan las reglas de `lib/agenda/presencial.ts`
 * para reservar (CA1/CA2) o reprogramar (CA4): turnos que ocupan horarios del
 * médico y del paciente, el límite de un turno vigente por especialidad y la
 * habilitación del paciente. Cada función recibe el cliente a usar, para
 * poder correr dentro de la transacción que bloquea la jornada.
 */

type Db = Prisma.TransactionClient | typeof prisma;

const ESTADOS_ACTIVOS: ("RESERVADO" | "CONFIRMADO")[] = [
  "RESERVADO",
  "CONFIRMADO",
];

function fechaDb(fecha: string): Date {
  return new Date(`${fecha}T00:00:00Z`);
}

function aIntervalo(turno: { hora: Date; duracionMin: number }): Intervalo {
  const desde = turno.hora.getUTCHours() * 60 + turno.hora.getUTCMinutes();
  return { desde, hasta: desde + turno.duracionMin };
}

/** Horarios ocupados de una jornada (confirmados y retenciones vigentes). */
export async function cargarOcupadosJornada(
  db: Db,
  disponibilidadId: bigint,
  ahora: Date,
): Promise<Intervalo[]> {
  const turnos = await db.turno.findMany({
    where: { disponibilidadId, estado: { in: ESTADOS_ACTIVOS } },
    select: {
      estado: true,
      retenidoHasta: true,
      hora: true,
      duracionMin: true,
    },
  });
  return turnos.filter((t) => ocupaCupo(t, ahora)).map(aIntervalo);
}

/**
 * CA2 (superposiciones): turnos del paciente en esa fecha, con cualquier
 * profesional, en jornadas publicadas. `excluirTurnoId` deja afuera la cita
 * que se está reprogramando.
 */
export async function cargarOcupadosPaciente(
  db: Db,
  pacienteId: bigint,
  fecha: string,
  ahora: Date,
  excluirTurnoId?: bigint,
): Promise<Intervalo[]> {
  const turnos = await db.turno.findMany({
    where: {
      pacienteId,
      estado: { in: ESTADOS_ACTIVOS },
      disponibilidad: { fecha: fechaDb(fecha), estado: "PUBLICADA" },
      ...(excluirTurnoId !== undefined ? { id: { not: excluirTurnoId } } : {}),
    },
    select: {
      estado: true,
      retenidoHasta: true,
      hora: true,
      duracionMin: true,
    },
  });
  return turnos.filter((t) => ocupaCupo(t, ahora)).map(aIntervalo);
}

/**
 * CA2/CA4: límite de un turno vigente por especialidad, con la misma regla
 * que `cargarCitasVigentesEspecialidad` del autoservicio. Indica además si
 * la cita vigente está pendiente de resolución por una jornada suspendida.
 * `excluirTurnoId` deja afuera el turno que reemplaza una reprogramación.
 */
export async function buscarCitaVigenteEspecialidad(
  db: Db,
  pacienteId: bigint,
  especialidadId: bigint,
  ahora: Date,
  excluirTurnoId?: bigint,
): Promise<{ pendienteResolucion: boolean } | null> {
  const turnos = await db.turno.findMany({
    where: {
      pacienteId,
      tipo: "CONSULTA",
      estado: { in: ESTADOS_ACTIVOS },
      disponibilidad: {
        fecha: { gte: fechaDb(hoySala(ahora)) },
        profesional: { medico: { especialidadId } },
      },
      ...(excluirTurnoId !== undefined ? { id: { not: excluirTurnoId } } : {}),
    },
    select: {
      estado: true,
      retenidoHasta: true,
      disponibilidad: { select: { estado: true } },
    },
  });
  const vigentes = turnos.filter((t) => ocupaCupo(t, ahora));
  if (vigentes.length === 0) return null;
  return {
    pendienteResolucion: vigentes.every(
      (t) => t.disponibilidad.estado === "SUSPENDIDA",
    ),
  };
}

/**
 * Libera las retenciones vencidas de la jornada antes de ocupar un horario,
 * igual que `liberarRetencionesExpiradas` (US-012): así no quedan dos turnos
 * activos en el mismo horario.
 */
export async function liberarRetencionesVencidas(
  tx: Prisma.TransactionClient,
  disponibilidadId: bigint,
  ahora: Date,
): Promise<void> {
  const vencidas = await tx.turno.findMany({
    where: {
      disponibilidadId,
      estado: "RESERVADO",
      retenidoHasta: { lte: ahora },
    },
    select: { id: true },
  });
  for (const turno of vencidas) {
    await tx.turno.update({
      where: { id: turno.id },
      data: { estado: "CANCELADO", retenidoHasta: null },
    });
    await tx.auditoria.create({
      data: {
        accion: AUDITORIA.CANCELACION_EXPIRACION,
        entidad: "turno",
        referenciaId: turno.id,
        detalle: JSON.stringify({ motivo: "retencion_expirada" }),
      },
    });
  }
}

type CuentaPaciente = { rol: string; activo: boolean } | null;

/** Campos de `paciente` que necesita `habilitacionDe`. */
export const SELECCION_HABILITACION = {
  fechaNacimiento: true,
  persona: {
    select: {
      nombreCompleto: true,
      usuario: { select: { rol: true, activo: true } },
    },
  },
  tutor: {
    select: {
      fechaNacimiento: true,
      persona: { select: { usuario: { select: { rol: true, activo: true } } } },
    },
  },
} satisfies Prisma.PacienteSelect;

/** CA1: habilitación de un registro Paciente cargado con `SELECCION_HABILITACION`. */
export function habilitacionDe(
  paciente: {
    fechaNacimiento: Date;
    persona: { usuario: CuentaPaciente };
    tutor: {
      fechaNacimiento: Date;
      persona: { usuario: CuentaPaciente };
    } | null;
  },
  hoy: string,
) {
  return evaluarHabilitacionPaciente(
    {
      fechaNacimiento: paciente.fechaNacimiento.toISOString().slice(0, 10),
      usuario: paciente.persona.usuario,
      tutor: paciente.tutor
        ? {
            fechaNacimiento: paciente.tutor.fechaNacimiento
              .toISOString()
              .slice(0, 10),
            usuario: paciente.tutor.persona.usuario,
          }
        : null,
    },
    hoy,
  );
}
