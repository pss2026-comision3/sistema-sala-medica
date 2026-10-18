import { MSG } from "@/lib/auth/constants";
import { Prisma } from "@/generated/prisma/client";

/**
 * [INTEGRACION-US016] Helper de compatibilidad mientras se incorpora US-SIG-016.
 *
 * Centraliza la validación de estados y resultados de atención:
 * - Una cita confirmada inicia en `SIN_REGISTRAR`.
 * - Al guardar la consulta médica, pasa a `ATENDIDO` (US-017 CA3 / US-016 CA1).
 * - Si fue marcada como `AUSENTE`, no admite registrar consulta (US-016 CA4 / US-017 CA1).
 * - Si ya fue atendida, no se duplica la consulta (US-017 CA3).
 */

export interface ValidacionCitaAtencionInput {
  estado: string; // EstadoTurno
  resultado: string; // ResultadoAtencion
  inicio: Date | string;
  jornadaSuspendida?: boolean;
}

export function validarCitaAptaParaConsulta(
  input: ValidacionCitaAtencionInput,
  ahora: Date = new Date(),
): { puede: boolean; motivo: string } {
  if (input.estado === "RESERVADO") {
    return {
      puede: false,
      motivo: "Es una retención temporal, no una cita confirmada.",
    };
  }

  if (input.estado !== "CONFIRMADO") {
    return {
      puede: false,
      motivo: MSG.CONSULTA_NO_CONFIRMADA,
    };
  }

  if (input.jornadaSuspendida) {
    return {
      puede: false,
      motivo: MSG.CONSULTA_JORNADA_SUSPENDIDA,
    };
  }

  const inicioFecha =
    typeof input.inicio === "string" ? new Date(input.inicio) : input.inicio;
  if (ahora < inicioFecha) {
    return {
      puede: false,
      motivo: MSG.CONSULTA_HORARIO_NO_ALCANZADO,
    };
  }

  if (input.resultado === "ATENDIDO") {
    return {
      puede: false,
      motivo: MSG.CONSULTA_YA_ATENDIDA,
    };
  }

  if (input.resultado === "AUSENTE") {
    return {
      puede: false,
      motivo: MSG.CONSULTA_MARCADA_AUSENTE,
    };
  }

  if (input.resultado !== "SIN_REGISTRAR") {
    return {
      puede: false,
      motivo:
        "El resultado actual de la cita no permite registrar la atención.",
    };
  }

  return { puede: true, motivo: "" };
}

/**
 * Actualiza el turno a ATENDIDO dentro de una transacción de Prisma.
 * Compatible con la especificación de US-016 CA1 y US-017 CA3.
 */
export async function marcarTurnoAtendidoTx(
  tx: Prisma.TransactionClient,
  turnoId: bigint,
  ahora: Date = new Date(),
) {
  return tx.turno.update({
    where: { id: turnoId },
    data: {
      resultado: "ATENDIDO",
      atendidoEn: ahora,
    },
  });
}
