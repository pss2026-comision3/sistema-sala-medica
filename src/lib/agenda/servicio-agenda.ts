/**
 * Servicio de la agenda médica (US-010) sobre datos reales (US-016).
 *
 * Las jornadas salen de `disponibilidad` (publicadas o suspendidas, US-008/US-009)
 * y las citas de `turno` (US-012/US-014/US-016). Las pantallas no cambian: solo
 * consumen estas firmas y los tipos de `tipos.ts`.
 */

import { prisma } from "@/lib/db/prisma";

import { diasDelMes, estaPendienteDeResolver, inicioTurno } from "./reglas";
import type {
  DiaAgenda,
  EstadoJornadaAgenda,
  EstadoTurnoAgenda,
  FiltrosAgenda,
  JornadaAgenda,
  MedicoAgenda,
  ResultadoAgenda,
  TurnoAgenda,
} from "./tipos";

/** HH:MM de un campo `time` de Postgres (Prisma lo entrega como Date en UTC). */
function horaTexto(valor: Date): string {
  return valor.toISOString().slice(11, 16);
}

/** YYYY-MM-DD de un campo `date` de Postgres. */
function fechaTexto(valor: Date): string {
  return valor.toISOString().slice(0, 10);
}

const ESTADO_DESDE_FILTRO = {
  reservado: "RESERVADO",
  confirmado: "CONFIRMADO",
  cancelado: "CANCELADO",
} as const;

const RESULTADO_DESDE_FILTRO = {
  sin_registrar: "SIN_REGISTRAR",
  atendido: "ATENDIDO",
  ausente: "AUSENTE",
} as const;

/** CA5: médicos activos para el selector de administración. */
export async function listarMedicosAgenda(): Promise<MedicoAgenda[]> {
  const medicos = await prisma.usuario.findMany({
    where: { rol: "MEDICO", activo: true },
    select: {
      id: true,
      persona: { select: { nombreCompleto: true } },
      medico: { select: { especialidad: { select: { nombre: true } } } },
    },
    orderBy: { persona: { nombreCompleto: "asc" } },
  });

  return medicos.map((medico) => ({
    id: medico.id.toString(),
    nombre: medico.persona.nombreCompleto,
    especialidad: medico.medico?.especialidad?.nombre ?? "Sin especialidad",
  }));
}

/**
 * CA2: la agenda muestra únicamente las citas del médico indicado, filtradas por
 * estado y resultado (CA1). En vista de día siempre aparece la fecha pedida; en
 * vista de mes solo los días con jornadas o turnos.
 */
export async function obtenerAgendaMedico({
  medicoId,
  filtros,
}: {
  medicoId: string;
  filtros: FiltrosAgenda;
}): Promise<DiaAgenda[]> {
  let profesionalId: bigint;
  try {
    profesionalId = BigInt(medicoId);
  } catch {
    return [];
  }

  const fechas =
    filtros.vista === "mes" ? diasDelMes(filtros.fecha) : [filtros.fecha];
  const porFecha = new Map<string, DiaAgenda>(
    fechas.map((fecha) => [fecha, { fecha, jornadas: [], turnos: [] }]),
  );

  const disponibilidades = await prisma.disponibilidad.findMany({
    where: {
      profesionalId,
      fecha: {
        gte: new Date(`${fechas[0]}T00:00:00Z`),
        lte: new Date(`${fechas[fechas.length - 1]}T00:00:00Z`),
      },
    },
    select: {
      fecha: true,
      horaDesde: true,
      horaHasta: true,
      estado: true,
      turnos: {
        where: {
          ...(filtros.estado !== "todos"
            ? { estado: ESTADO_DESDE_FILTRO[filtros.estado] }
            : {}),
          ...(filtros.resultado !== "todos"
            ? { resultado: RESULTADO_DESDE_FILTRO[filtros.resultado] }
            : {}),
        },
        select: {
          id: true,
          hora: true,
          duracionMin: true,
          estado: true,
          resultado: true,
          modalidad: true,
          coberturaNombreSnapshot: true,
          paciente: {
            select: {
              dni: true,
              persona: { select: { nombreCompleto: true } },
            },
          },
        },
      },
    },
    orderBy: [{ fecha: "asc" }, { horaDesde: "asc" }],
  });

  for (const fila of disponibilidades) {
    const fecha = fechaTexto(fila.fecha);
    const dia = porFecha.get(fecha);
    if (!dia) continue;

    const jornada: JornadaAgenda = {
      fecha,
      horaDesde: horaTexto(fila.horaDesde),
      horaHasta: horaTexto(fila.horaHasta),
      estado: fila.estado as EstadoJornadaAgenda,
    };
    dia.jornadas.push(jornada);

    for (const turno of fila.turnos) {
      const hora = horaTexto(turno.hora);
      const filaTurno: TurnoAgenda = {
        id: turno.id.toString(),
        fecha,
        hora,
        inicio: inicioTurno(fecha, hora),
        duracionMin: turno.duracionMin,
        estado: turno.estado as EstadoTurnoAgenda,
        resultado: turno.resultado as ResultadoAgenda,
        paciente: {
          nombre: turno.paciente.persona.nombreCompleto,
          dni: turno.paciente.dni,
          obraSocial:
            turno.modalidad === "CON_COBERTURA"
              ? (turno.coberturaNombreSnapshot ?? "Con cobertura")
              : null,
        },
        pendienteDeResolver: false,
      };
      filaTurno.pendienteDeResolver = estaPendienteDeResolver(filaTurno, jornada);
      dia.turnos.push(filaTurno);
    }
  }

  const dias: DiaAgenda[] = [];
  for (const fecha of fechas) {
    const dia = porFecha.get(fecha);
    if (!dia) continue;
    dia.turnos.sort((a, b) => a.hora.localeCompare(b.hora));
    if (
      filtros.vista === "dia" ||
      dia.jornadas.length > 0 ||
      dia.turnos.length > 0
    ) {
      dias.push(dia);
    }
  }
  return dias;
}

/**
 * CA3 y CA4: devuelve la cita y su jornada solo si pertenece al médico indicado.
 * La jornada es la propia `disponibilidad` del turno.
 */
export async function obtenerTurnoMedico({
  medicoId,
  turnoId,
}: {
  medicoId: string;
  turnoId: string;
}): Promise<{ turno: TurnoAgenda; jornada: JornadaAgenda } | null> {
  let profesionalId: bigint;
  let id: bigint;
  try {
    profesionalId = BigInt(medicoId);
    id = BigInt(turnoId);
  } catch {
    return null;
  }

  const fila = await prisma.turno.findFirst({
    where: { id, disponibilidad: { profesionalId } },
    select: {
      id: true,
      hora: true,
      duracionMin: true,
      estado: true,
      resultado: true,
      modalidad: true,
      coberturaNombreSnapshot: true,
      paciente: {
        select: {
          dni: true,
          persona: { select: { nombreCompleto: true } },
        },
      },
      disponibilidad: {
        select: {
          fecha: true,
          horaDesde: true,
          horaHasta: true,
          estado: true,
        },
      },
    },
  });
  if (!fila) return null;

  const fecha = fechaTexto(fila.disponibilidad.fecha);
  const hora = horaTexto(fila.hora);
  const jornada: JornadaAgenda = {
    fecha,
    horaDesde: horaTexto(fila.disponibilidad.horaDesde),
    horaHasta: horaTexto(fila.disponibilidad.horaHasta),
    estado: fila.disponibilidad.estado as EstadoJornadaAgenda,
  };
  const turno: TurnoAgenda = {
    id: fila.id.toString(),
    fecha,
    hora,
    inicio: inicioTurno(fecha, hora),
    duracionMin: fila.duracionMin,
    estado: fila.estado as EstadoTurnoAgenda,
    resultado: fila.resultado as ResultadoAgenda,
    paciente: {
      nombre: fila.paciente.persona.nombreCompleto,
      dni: fila.paciente.dni,
      obraSocial:
        fila.modalidad === "CON_COBERTURA"
          ? (fila.coberturaNombreSnapshot ?? "Con cobertura")
          : null,
    },
    pendienteDeResolver: false,
  };
  turno.pendienteDeResolver = estaPendienteDeResolver(turno, jornada);

  return { turno, jornada };
}
