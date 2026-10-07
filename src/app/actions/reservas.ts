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

export type ResultadoReserva =
  { exito: true; turnoId: string; retenidoHasta: Date } | { error: string };

export type ResultadoConfirmacion = { exito: true } | { error: string };

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
            disponibilidadId: disponibilidadId, // ✅ string, no BigInt
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
    },
  });
  if (!turno) {
    return { error: "Turno no encontrado." };
  }
  if (turno.creadoPor !== usuarioId) {
    return { error: "No tenés permiso para confirmar este turno." };
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
      await tx.turno.update({
        where: { id: turnoIdBig },
        data: {
          estado: "CONFIRMADO",
          retenidoHasta: null,
        },
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
