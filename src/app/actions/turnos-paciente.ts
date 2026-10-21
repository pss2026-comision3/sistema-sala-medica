"use server";

import { prisma } from "@/lib/db/prisma";
import { inicioTurno, puedeCancelarTurno } from "@/lib/agenda/reglas";
import { AUDITORIA, MSG } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/guards";
import {crearAvisoCancelacion} from "@/lib/notificaciones/avisos";
import { cargarBeneficiarios } from "@/lib/turnos/buscar-horarios";
import { notificarPorEmail } from "@/lib/notificaciones/email-turno";

export async function cancelarTurnoPaciente(input: {
  turnoId: string;
  motivo?: string;
}): Promise<{ exito: true; mensaje: string } | { error: string }> {
  const sesion = await requireRole("PACIENTE");
  const usuarioId = BigInt(sesion.usuarioId);

  let turnoId: bigint;
  try {
    turnoId = BigInt(input.turnoId);
  } catch {
    return { error: MSG.CANCELACION_NO_ENCONTRADO };
  }
  const ahora = new Date();

  const turno = await prisma.turno.findUnique({
    where: { id: turnoId },
    include: {
      paciente: { select: { persona: { select: { nombreCompleto: true } } } },
      vacuna: { select: { nombre: true } },
      disponibilidad: {
        select: {
          fecha: true,
          estado: true,
          profesional: {
            select: {
              persona: { select: { nombreCompleto: true } },
              medico: {
                select: { especialidad: { select: { nombre: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!turno) {
    return { error: MSG.CANCELACION_NO_ENCONTRADO };
  }

  // CA1: la cita debe pertenecer al titular o a un menor a cargo vigente.
  const beneficiarios = await cargarBeneficiarios(usuarioId, ahora);
  const pertenece = beneficiarios.some(
    (b) => b.id === turno.pacienteId.toString(),
  );
  if (!pertenece) {
    return { error: MSG.CITA_SIN_ACCESO };
  }

  const fecha = turno.disponibilidad.fecha.toISOString().slice(0, 10);
  const hora = turno.hora.toISOString().slice(11, 16);
  const inicio = inicioTurno(fecha, hora);

  // CA1: cita confirmada, sin atención registrada y con 24 horas o más.
  const puede = puedeCancelarTurno(
    { estado: turno.estado, inicio, resultado: turno.resultado },
    ahora,
  );
  if (!puede.puede) {
    return { error: puede.motivo };
  }

  const motivo = input.motivo?.trim() || "Cancelación por el paciente";
  const beneficiarioNombre = turno.paciente.persona.nombreCompleto;
  const profesional = turno.disponibilidad.profesional.persona.nombreCompleto;
  const prestacion =
    turno.tipo === "VACUNACION"
      ? (turno.vacuna?.nombre ?? "Vacunación")
      : (turno.disponibilidad.profesional.medico?.especialidad?.nombre ??
        "Consulta médica");
  const jornadaSuspendida = turno.disponibilidad.estado === "SUSPENDIDA";

  try {
    await prisma.$transaction(async (tx) => {
      // Guarda contra carreras: solo cancela si sigue confirmada y sin resultado.
      const { count } = await tx.turno.updateMany({
        where: {
          id: turnoId,
          estado: "CONFIRMADO",
          resultado: "SIN_REGISTRAR",
        },
        data: {
          estado: "CANCELADO",
          canceladoEn: ahora,
          canceladoPor: usuarioId,
          motivoCancelacion: motivo,
          origenCancelacion: "paciente",
          retenidoHasta: null,
        },
      });
      if (count === 0) {
        throw new Error(MSG.CANCELACION_ESTADO);
      }

      // CA4: se notifica la cancelación mediante un aviso interno.
      // (Se eliminó anularRecordatoriosPendientes porque ya no usamos la tabla EventoEmail).
      await crearAvisoCancelacion(tx, {
        turnoId,
        usuarioId, // Usamos el ID del usuario directamente (la firma nueva)
        resumen: [
          `Se canceló el turno de ${beneficiarioNombre}.`,
          `Prestación: ${prestacion}.`,
          `Fecha: ${fecha} a las ${hora} hs.`,
          `Profesional: ${profesional}.`,
        ].join(" "),
      });

      await tx.auditoria.create({
        data: {
          actorId: usuarioId,
          accion: AUDITORIA.CANCELACION_TURNO_PACIENTE,
          entidad: "turno",
          referenciaId: turnoId,
          detalle: JSON.stringify({
            beneficiarioId: turno.pacienteId.toString(),
            motivo,
            resultadoPrevio: turno.resultado,
            jornadaSuspendida,
          }),
        },
      });
    });

    // Llamada para enviar el email
    notificarPorEmail("CANCELACION", turnoId);

    return { exito: true, mensaje: MSG.CANCELACION_EXITO };
  } catch (error) {
    console.error("Error cancelando turno:", error);
    if (error instanceof Error && error.message === MSG.CANCELACION_ESTADO) {
      return { error: MSG.CANCELACION_ESTADO };
    }
    return { error: "Error interno al cancelar el turno." };
  }
}
