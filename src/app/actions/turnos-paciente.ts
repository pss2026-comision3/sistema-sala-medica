"use server";

import { prisma } from "@/lib/db/prisma";
import { inicioTurno, puedeCancelarTurno } from "@/lib/agenda/reglas";
import { AUDITORIA, MSG } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/guards";
import { cargarBeneficiarios } from "@/lib/turnos/buscar-horarios";

export async function cancelarTurnoPaciente(input: {
  turnoId: string;
  motivo?: string;
}): Promise<{ exito: true; mensaje: string } | { error: string }> {
  const sesion = await requireRole("PACIENTE");
  const usuarioId = BigInt(sesion.usuarioId);
  let turnoIdBig: bigint;
  try {
    turnoIdBig = BigInt(input.turnoId);
  } catch {
    return { error: MSG.CANCELACION_NO_ENCONTRADO };
  }
  const ahora = new Date();

  const turno = await prisma.turno.findUnique({
    where: { id: turnoIdBig },
    include: {
      disponibilidad: { select: { fecha: true } },
    },
  });
  if (!turno) {
    return { error: MSG.CANCELACION_NO_ENCONTRADO };
  }

  const beneficiarios = await cargarBeneficiarios(usuarioId, ahora);
  const pertenece = beneficiarios.some(
    (b) => b.id === turno.pacienteId.toString(),
  );
  if (!pertenece) {
    return { error: MSG.CITA_SIN_ACCESO };
  }

  if (turno.estado !== "CONFIRMADO") {
    return { error: MSG.CANCELACION_ESTADO };
  }

  const fecha = turno.disponibilidad.fecha.toISOString().slice(0, 10);
  const hora = turno.hora.toISOString().slice(11, 16);
  const inicio = inicioTurno(fecha, hora);
  const puede = puedeCancelarTurno({ estado: turno.estado, inicio }, ahora);
  if (!puede.puede) {
    return { error: puede.motivo };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.turno.update({
        where: { id: turnoIdBig },
        data: {
          estado: "CANCELADO",
          canceladoEn: ahora,
          canceladoPor: usuarioId,
          motivoCancelacion: input.motivo || "Cancelación por el paciente",
          origenCancelacion: "paciente",
          retenidoHasta: null,
        },
      });

      await tx.auditoria.create({
        data: {
          actorId: usuarioId,
          accion: AUDITORIA.CANCELACION_TURNO_PACIENTE,
          entidad: "turno",
          referenciaId: turnoIdBig,
          detalle: JSON.stringify({
            beneficiarioId: turno.pacienteId.toString(),
            motivo: input.motivo || "cancelacion_usuario",
          }),
        },
      });
    });
    return { exito: true, mensaje: MSG.CANCELACION_EXITO };
  } catch (error) {
    console.error("Error cancelando turno:", error);
    return { error: "Error interno al cancelar el turno." };
  }
}
