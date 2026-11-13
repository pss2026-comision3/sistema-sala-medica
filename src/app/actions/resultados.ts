"use server";

import { evaluarRegistroAusencia, inicioTurno } from "@/lib/agenda/reglas";
import type { EstadoJornadaAgenda } from "@/lib/agenda/tipos";
import { AUDITORIA } from "@/lib/auth/constants";
import { requireAlgunRol } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";

export type ResultadoAusencia = { exito: true; mensaje: string } | { error: string };

const MSG_NO_ENCONTRADO =
  "La cita solicitada no existe o ya no está disponible.";
const MSG_SIN_ACCESO = "No tenés acceso a esta cita.";
const MSG_YA_REGISTRADO =
  "La cita ya tiene un resultado de atención registrado.";
const MSG_EXITO =
  "Ausencia registrada. La reserva se conserva con el resultado Ausente.";
const MSG_ERROR_INTERNO = "Error interno al registrar la ausencia.";

/**
 * US-SIG-016 (RF-13): registra una ausencia sobre una cita médica o de vacunación.
 *
 * - CA1 y CA4: solo desde una cita confirmada con resultado `Sin registrar`; una
 *   atención ya documentada nunca se revierte.
 * - CA2: el Médico registra las ausencias de sus consultas (después del fin
 *   previsto) y Enfermería las del vacunatorio, liberando la dosis comprometida
 *   sin tocar el stock físico.
 * - CA3: las citas canceladas o de jornada suspendida no admiten resultados y
 *   una cita pasada sin resultado queda pendiente de revisión, nunca ausente
 *   automática.
 */
export async function registrarAusencia(
  turnoId: string,
): Promise<ResultadoAusencia> {
  const sesion = await requireAlgunRol("MEDICO", "ENFERMERIA");

  let id: bigint;
  try {
    id = BigInt(turnoId);
  } catch {
    return { error: MSG_NO_ENCONTRADO };
  }

  const ahora = new Date();
  const turno = await prisma.turno.findUnique({
    where: { id },
    select: {
      id: true,
      tipo: true,
      hora: true,
      duracionMin: true,
      estado: true,
      resultado: true,
      disponibilidad: {
        select: { fecha: true, estado: true, profesionalId: true },
      },
      consulta: { select: { turnoId: true } },
    },
  });
  if (!turno) {
    return { error: MSG_NO_ENCONTRADO };
  }

  // CA2: cada rol registra las ausencias de su ámbito.
  if (sesion.rol === "MEDICO") {
    const esPropia =
      turno.tipo === "CONSULTA" &&
      turno.disponibilidad.profesionalId.toString() === sesion.usuarioId;
    if (!esPropia) return { error: MSG_SIN_ACCESO };
  } else if (turno.tipo !== "VACUNACION") {
    return { error: MSG_SIN_ACCESO };
  }

  const fecha = turno.disponibilidad.fecha.toISOString().slice(0, 10);
  const hora = turno.hora.toISOString().slice(11, 16);
  const inicio = inicioTurno(fecha, hora);
  const jornada = {
    fecha,
    horaDesde: hora,
    horaHasta: hora,
    estado: turno.disponibilidad.estado as EstadoJornadaAgenda,
  };
  const regla = evaluarRegistroAusencia(
    {
      estado: turno.estado,
      resultado: turno.resultado,
      inicio,
      duracionMin: turno.duracionMin,
    },
    jornada,
    ahora,
  );
  if (!regla.puede) {
    // Una atención ya documentada con su consulta conserva ese resultado (CA4).
    return {
      error: turno.consulta ? MSG_YA_REGISTRADO : regla.motivo,
    };
  }

  try {
    const aplicado = await prisma.$transaction(async (tx) => {
      const resultado = await tx.turno.updateMany({
        where: {
          id,
          estado: "CONFIRMADO",
          resultado: "SIN_REGISTRAR",
        },
        data: {
          resultado: "AUSENTE",
          // CA2: la ausencia del vacunatorio libera la dosis comprometida. El
          // inventario físico no se toca: solo se registra al aplicar (US-025).
          ...(turno.tipo === "VACUNACION" ? { loteReservadoId: null } : {}),
        },
      });
      if (resultado.count === 0) return false;

      await tx.auditoria.create({
        data: {
          actorId: BigInt(sesion.usuarioId),
          accion:
            turno.tipo === "VACUNACION"
              ? AUDITORIA.RESULTADO_AUSENCIA_VACUNACION
              : AUDITORIA.RESULTADO_AUSENCIA_MEDICA,
          entidad: "turno",
          referenciaId: id,
          detalle: JSON.stringify({ resultado: "AUSENTE" }),
        },
      });
      return true;
    });

    if (!aplicado) return { error: MSG_YA_REGISTRADO };
    return { exito: true, mensaje: MSG_EXITO };
  } catch (error) {
    console.error("Error registrando la ausencia:", error);
    return { error: MSG_ERROR_INTERNO };
  }
}
