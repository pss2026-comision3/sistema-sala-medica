"use server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/guards";
import { AUDITORIA } from "@/lib/auth/constants";
import {
  calcularRetenidoHasta,
  puedeConfirmarReserva,
  RETENCION_MINUTOS,
} from "@/lib/agenda/reservas";
import { crearAvisoConfirmacion } from "@/lib/notificaciones/avisos";

export type ResultadoReserva =
  { exito: true; turnoId: string; retenidoHasta: Date } | { error: string };

export type ResultadoConfirmacion = { exito: true } | { error: string };

const MSG_JORNADA_SUSPENDIDA =
  "La jornada de este turno fue suspendida y ya no admite reservas.";

class ErrorJornadaSuspendida extends Error {}

/**
 * US-009 CA2: bloquea la fila de la jornada (`SELECT ... FOR UPDATE`) y
 * verifica que siga publicada. Como la suspensión también actualiza esa fila,
 * una reserva o confirmación concurrente espera a que termine y ve el estado
 * definitivo: nunca se crea ni confirma un turno en una jornada suspendida.
 */
async function jornadaSiguePublicada(
  tx: Prisma.TransactionClient,
  disponibilidadId: bigint,
): Promise<boolean> {
  const filas = await tx.$queryRaw<{ estado: string }[]>`
    SELECT "estado"::text AS "estado"
    FROM "disponibilidad"
    WHERE "id" = ${disponibilidadId}
    FOR UPDATE`;
  return filas[0]?.estado === "PUBLICADA";
}

/**
 * Reserva un cupo por 5 minutos (estado RESERVADO).
 * - Verifica que la disponibilidad exista y esté PUBLICADA
 * - Verifica que no haya turno RESERVADO/CONFIRMADO para esa disponibilidad
 * - Crea el Turno con retenido_hasta = now() + 5 min
 * - Audita la reserva
 */
export async function reservarTurnoTemporal(
  disponibilidadId: string,
  pacienteId: string,
  hora: string, // HH:MM desde la UI (US-011)
): Promise<ResultadoReserva> {
  // 1. Solo PACIENTE autenticado puede reservar
  const sesion = await requireRole("PACIENTE");
  const usuarioId = BigInt(sesion.usuarioId);
  const pacienteIdBig = BigInt(pacienteId);

  // 2. Verificar que el paciente pertenezca al usuario logueado
  const paciente = await prisma.paciente.findUnique({
    where: { personaId: pacienteIdBig },
    select: { personaId: true },
  });
  if (!paciente) {
    return { error: "Paciente no encontrado." };
  }

  // 3. Verificar disponibilidad y que no esté suspendida
  const disponibilidad = await prisma.disponibilidad.findUnique({
    where: { id: BigInt(disponibilidadId) },
    select: {
      id: true,
      estado: true,
      profesionalId: true,
      horaDesde: true,
      horaHasta: true,
    },
  });
  if (!disponibilidad) {
    return { error: "El cupo seleccionado no existe." };
  }
  if (disponibilidad.estado !== "PUBLICADA") {
    return { error: "El cupo ya no está disponible." };
  }

  // 4. Verificar que la hora esté dentro del rango de la disponibilidad
  const [hD, mD] = disponibilidad.horaDesde.toString().split(":");
  const [hH, mH] = disponibilidad.horaHasta.toString().split(":");
  const [hS, mS] = hora.split(":").map(Number);
  const inicioMin = parseInt(hD) * 60 + parseInt(mD);
  const finMin = parseInt(hH) * 60 + parseInt(mH);
  const solicitudMin = hS * 60 + mS;
  if (solicitudMin < inicioMin || solicitudMin + 1 > finMin) {
    // +1 para al menos 1 min
    return {
      error: "La hora seleccionada no está dentro del rango disponible.",
    };
  }

  // 5. Verificar que no exista turno RESERVADO o CONFIRMADO para esta disponibilidad Y hora
  const turnoExistente = await prisma.turno.findFirst({
    where: {
      disponibilidadId: BigInt(disponibilidadId),
      hora: new Date(`1970-01-01T${hora}:00Z`),
      estado: { in: ["RESERVADO", "CONFIRMADO"] },
    },
    select: { id: true, estado: true },
  });
  if (turnoExistente) {
    return {
      error:
        turnoExistente.estado === "RESERVADO"
          ? "El cupo ya fue reservado por otro paciente."
          : "El cupo ya fue confirmado por otro paciente.",
    };
  }

  // 6. Obtener datos del médico para snapshot en turno
  const medico = await prisma.usuario.findUnique({
    where: { id: disponibilidad.profesionalId },
    include: {
      medico: { select: { duracionTurnoMin: true, arancelActual: true } },
      persona: true,
    },
  });
  if (!medico || !medico.medico) {
    return { error: "Configuración del profesional no encontrada." };
  }

  const { duracionTurnoMin, arancelActual } = medico.medico;

  const ahora = new Date();
  const retenidoHasta = calcularRetenidoHasta(ahora);
  const horaDate = new Date(`1970-01-01T${hora}:00Z`);

  try {
    // 7. Transacción: crear turno + auditoría
    const resultado = await prisma.$transaction(async (tx) => {
      // US-009 CA2: la jornada pudo suspenderse después del chequeo inicial.
      if (!(await jornadaSiguePublicada(tx, BigInt(disponibilidadId)))) {
        throw new ErrorJornadaSuspendida(MSG_JORNADA_SUSPENDIDA);
      }

      const turno = await tx.turno.create({
        data: {
          pacienteId: pacienteIdBig,
          disponibilidadId: BigInt(disponibilidadId),
          creadoPor: usuarioId,
          tipo: "CONSULTA",
          hora: horaDate,
          duracionMin: duracionTurnoMin,
          arancel: arancelActual,
          modalidad: "PARTICULAR",
          estado: "RESERVADO",
          retenidoHasta,
        },
      });

      // Auditar
      await tx.auditoria.create({
        data: {
          actorId: usuarioId,
          accion: AUDITORIA.RESERVA_TURNO,
          entidad: "turno",
          referenciaId: turno.id,
          detalle: JSON.stringify({
            disponibilidadId: disponibilidadId,
            hora,
            retenidoMinutos: RETENCION_MINUTOS,
          }),
        },
      });

      return turno;
    });

    return {
      exito: true,
      turnoId: resultado.id.toString(),
      retenidoHasta,
    };
  } catch (error) {
    // US-009 CA2: la jornada se suspendió mientras se reservaba.
    if (error instanceof ErrorJornadaSuspendida) {
      return { error: error.message };
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Race condition: otro request ganó la reserva
      return {
        error: "El cupo ya no está disponible (otra reserva simultánea).",
      };
    }
    console.error("Error reservando turno:", error);
    return { error: "Error interno al reservar el turno." };
  }
}

/**
 * Confirma definitivamente una reserva (RESERVADO → CONFIRMADO).
 * - Verifica que el turno pertenezca al paciente logueado
 * - Verifica que esté en RESERVADO y retención vigente
 * - Actualiza estado a CONFIRMADO y limpia retenido_hasta
 * - Audita la confirmación
 */
export async function confirmarReservaDefinitiva(
  turnoId: string,
): Promise<ResultadoConfirmacion> {
  const sesion = await requireRole("PACIENTE");
  const usuarioId = BigInt(sesion.usuarioId);
  const turnoIdBig = BigInt(turnoId);

  // 1. Buscar turno y verificar pertenencia
  const turno = await prisma.turno.findUnique({
    where: { id: turnoIdBig },
    select: {
      id: true,
      pacienteId: true,
      estado: true,
      retenidoHasta: true,
      creadoPor: true,
      disponibilidadId: true, // US-009: para verificar que la jornada siga publicada
      origenCancelacion: true, // US-009: para explicar una retención liberada
      hora: true,
      tipo: true,
      vacuna: { select: { nombre: true } },
      disponibilidad: {
        select: {
          fecha: true,
          profesional: {
            select: { medico: { select: { especialidad: { select: { nombre: true } } } } },
          },
        },
      },
    },
  });
  if (!turno) {
    return { error: "Turno no encontrado." };
  }
  if (turno.creadoPor !== usuarioId) {
    return { error: "No tenés permiso para confirmar este turno." };
  }

  // US-009: la retención fue liberada por la suspensión de la jornada.
  if (
    turno.estado === "CANCELADO" &&
    turno.origenCancelacion === "suspension_jornada"
  ) {
    return { error: MSG_JORNADA_SUSPENDIDA };
  }

  // 2. Verificar que se pueda confirmar
  const { puede, motivo } = puedeConfirmarReserva(
    turno.estado as "RESERVADO" | "CONFIRMADO" | "CANCELADO",
    turno.retenidoHasta,
  );
  if (!puede) {
    return { error: motivo! };
  }

  // 3. Confirmar: estado → CONFIRMADO, limpiar retenido_hasta
  try {
    await prisma.$transaction(async (tx) => {
      // US-009 CA2: no se confirma en una jornada suspendida.
      if (!(await jornadaSiguePublicada(tx, turno.disponibilidadId))) {
        throw new ErrorJornadaSuspendida(MSG_JORNADA_SUSPENDIDA);
      }

      // Si la suspensión liberó la retención, el turno ya no está RESERVADO.
      const { count } = await tx.turno.updateMany({
        where: { id: turnoIdBig, estado: "RESERVADO" },
        data: {
          estado: "CONFIRMADO",
          retenidoHasta: null,
        },
      });
      if (count === 0) {
        throw new ErrorJornadaSuspendida(
          "La retención ya no está vigente. Volvé a buscar un horario.",
        );
      }

      // CA1 (US-031): generar el aviso interno de confirmación.
      const fechaFormat = turno.disponibilidad.fecha.toISOString().slice(0, 10);
      const horaFormat = turno.hora.toISOString().slice(11, 16);
      const prestacion = turno.tipo === "VACUNACION"
        ? (turno.vacuna?.nombre ?? "Vacunación")
        : (turno.disponibilidad.profesional.medico?.especialidad?.nombre ?? "Consulta médica");

      await crearAvisoConfirmacion(tx, {
        turnoId: turno.id,
        usuarioId: BigInt(sesion.usuarioId),
        resumen: `Tu turno para ${prestacion} el ${fechaFormat} a las ${horaFormat} hs ha sido confirmado.`,
      });

      // Auditar
      await tx.auditoria.create({
        data: {
          actorId: usuarioId,
          accion: AUDITORIA.CONFIRMACION_TURNO,
          entidad: "turno",
          referenciaId: turnoIdBig,
          detalle: JSON.stringify({ accion: "confirmacion_definitiva" }),
        },
      });
    });

    return { exito: true };
  } catch (error) {
    // US-009 CA2: la jornada se suspendió o la retención se liberó.
    if (error instanceof ErrorJornadaSuspendida) {
      return { error: error.message };
    }
    console.error("Error confirmando turno:", error);
    return { error: "Error interno al confirmar el turno." };
  }
}

/**
 * (Opcional) Libera retenciones expiradas: RESERVADO vencido → CANCELADO.
 * Útil para job programado o llamado desde búsqueda de cupos.
 * Retorna cantidad de turnos liberados.
 */
export async function liberarRetencionesExpiradas(): Promise<number> {
  const ahora = new Date();

  const turnosExpirados = await prisma.turno.findMany({
    where: {
      estado: "RESERVADO",
      retenidoHasta: { lt: ahora },
    },
    select: { id: true },
  });

  if (turnosExpirados.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    for (const t of turnosExpirados) {
      await tx.turno.update({
        where: { id: t.id },
        data: { estado: "CANCELADO", retenidoHasta: null },
      });
      // Auditar cancelación por expiración
      await tx.auditoria.create({
        data: {
          accion: AUDITORIA.CANCELACION_EXPIRACION,
          entidad: "turno",
          referenciaId: t.id,
          detalle: JSON.stringify({ motivo: "retencion_expirada" }),
        },
      });
    }
  });

  return turnosExpirados.length;
}

/**
 * Cancela una reserva temporal (RESERVADO → CANCELADO) y libera el cupo.
 * - Verifica que el turno pertenezca al paciente logueado
 * - Verifica que esté en RESERVADO
 * - Actualiza estado a CANCELADO, limpia retenido_hasta y setea campos de cancelación
 * - Audita la cancelación
 */
export async function cancelarReserva(
  turnoId: string,
): Promise<{ exito: true } | { error: string }> {
  const sesion = await requireRole("PACIENTE");
  const usuarioId = BigInt(sesion.usuarioId);
  const turnoIdBig = BigInt(turnoId);
  const ahora = new Date();

  // 1. Buscar turno y verificar pertenencia
  const turno = await prisma.turno.findUnique({
    where: { id: turnoIdBig },
    select: {
      id: true,
      estado: true,
      creadoPor: true,
    },
  });
  if (!turno) {
    return { error: "Turno no encontrado." };
  }
  if (turno.creadoPor !== usuarioId) {
    return { error: "No tenés permiso para cancelar este turno." };
  }
  if (turno.estado !== "RESERVADO") {
    return { error: "Solo se pueden cancelar reservas temporales (5 min)." };
  }

  // 2. Cancelar: estado → CANCELADO, limpiar retenido_hasta, setear campos requeridos por CHECK constraint
  try {
    await prisma.$transaction(async (tx) => {
      await tx.turno.update({
        where: { id: turnoIdBig },
        data: {
          estado: "CANCELADO",
          retenidoHasta: null,
          canceladoEn: ahora,
          canceladoPor: usuarioId,
          motivoCancelacion: "Cancelación por el paciente",
        },
      });

      // Auditar
      await tx.auditoria.create({
        data: {
          actorId: usuarioId,
          accion: AUDITORIA.CANCELACION_EXPIRACION,
          entidad: "turno",
          referenciaId: turnoIdBig,
          detalle: JSON.stringify({ motivo: "cancelacion_usuario" }),
        },
      });
    });

    return { exito: true };
  } catch (error) {
    console.error("Error cancelando reserva:", error);
    return { error: "Error interno al cancelar la reserva." };
  }
}
