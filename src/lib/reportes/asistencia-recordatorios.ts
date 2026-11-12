import { prisma } from "@/lib/db/prisma";
import { esFechaValida, inicioTurno } from "@/lib/agenda/reglas";
import type {
  DetalleCitaReporte,
  EstadoRecordatorioItem,
  FiltrosReporteAsistencia,
  OpcionSelector,
  ResultadoReporteAsistencia,
} from "./tipos";

/**
 * Consulta y calcula las métricas de asistencia, ausentismo y recordatorios (US-SIG-035).
 */
export async function consultarReporteAsistencia(
  filtros: FiltrosReporteAsistencia,
  contextoUsuario: { usuarioId: string; rol: "ADMIN" | "MEDICO" },
  ahora: Date = new Date(),
): Promise<ResultadoReporteAsistencia> {
  const { desde, hasta, medicoId, especialidadId } = filtros;

  if (!esFechaValida(desde) || !esFechaValida(hasta)) {
    throw new Error("El rango de fechas proporcionado no es válido.");
  }

  if (desde > hasta) {
    throw new Error("La fecha 'Desde' no puede ser posterior a la fecha 'Hasta'.");
  }

  // CA5: Restricción de alcance según el rol autenticado
  let profesionalIdFiltro: bigint | undefined;
  if (contextoUsuario.rol === "MEDICO") {
    profesionalIdFiltro = BigInt(contextoUsuario.usuarioId);
  } else if (contextoUsuario.rol === "ADMIN" && medicoId && medicoId !== "todos") {
    profesionalIdFiltro = BigInt(medicoId);
  }

  let especialidadIdFiltro: bigint | undefined;
  if (especialidadId && especialidadId !== "todos") {
    especialidadIdFiltro = BigInt(especialidadId);
  }

  // Consulta de turnos en el rango de fechas para consultas médicas
  const turnos = await prisma.turno.findMany({
    where: {
      tipo: "CONSULTA",
      disponibilidad: {
        fecha: {
          gte: new Date(`${desde}T00:00:00Z`),
          lte: new Date(`${hasta}T00:00:00Z`),
        },
        ...(profesionalIdFiltro ? { profesionalId: profesionalIdFiltro } : {}),
        ...(especialidadIdFiltro
          ? {
              profesional: {
                medico: {
                  especialidadId: especialidadIdFiltro,
                },
              },
            }
          : {}),
      },
    },
    include: {
      paciente: {
        select: {
          persona: { select: { nombreCompleto: true } },
        },
      },
      disponibilidad: {
        select: {
          fecha: true,
          profesional: {
            select: {
              persona: { select: { nombreCompleto: true } },
              medico: {
                select: {
                  especialidad: { select: { id: true, nombre: true } },
                },
              },
            },
          },
        },
      },
      eventosEmail: {
        where: { tipoEvento: "RECORDATORIO" },
        select: {
          intentos: {
            select: { resultado: true },
          },
        },
      },
    },
    orderBy: [
      { disponibilidad: { fecha: "desc" } },
      { hora: "desc" },
    ],
  });

  let atendidos = 0;
  let ausentes = 0;
  let sinRegistrar = 0;
  let cancelados = 0;
  let futurosExcluidos = 0;

  let recordatoriosEnviados = 0;
  let recordatoriosFallidos = 0;
  let reservaTardia = 0;
  let sinRecordatorio = 0;

  const ahoraMs = ahora.getTime();
  const citasDetalle: DetalleCitaReporte[] = [];

  for (const turno of turnos) {
    const fechaStr = turno.disponibilidad.fecha.toISOString().slice(0, 10);
    const horaStr = turno.hora.toISOString().slice(11, 16);
    const inicioMs = new Date(inicioTurno(fechaStr, horaStr)).getTime();
    const finMs = inicioMs + turno.duracionMin * 60 * 1000;
    const horarioTerminado = finMs <= ahoraMs;

    // Clasificación de recordatorio (CA4)
    let estadoRecordatorio: EstadoRecordatorioItem = "SIN_RECORDATORIO";
    const eventosRecordatorio = turno.eventosEmail;

    if (eventosRecordatorio.length > 0) {
      const tieneExito = eventosRecordatorio.some((e) =>
        e.intentos.some((i) => i.resultado === "EXITO"),
      );
      if (tieneExito) {
        estadoRecordatorio = "ENVIADO";
      } else {
        estadoRecordatorio = "FALLIDO";
      }
    } else {
      // CA4: Si no hubo recordatorio, evaluar si fue reserva tardía (< 24 hs de anticipación)
      const creadoEnMs = new Date(turno.creadoEn).getTime();
      const diffHoras = (inicioMs - creadoEnMs) / (1000 * 60 * 60);
      if (diffHoras < 24) {
        estadoRecordatorio = "RESERVA_TARDIA";
      } else {
        estadoRecordatorio = "SIN_RECORDATORIO";
      }
    }

    // CA1 y CA2: Evaluación de estados asistenciales
    if (turno.estado === "CANCELADO") {
      cancelados++;
    } else if (!horarioTerminado) {
      // CA1: Los turnos futuros no se contabilizan como ausencias ni sin registrar
      futurosExcluidos++;
    } else {
      // Horario terminado y turno no cancelado
      if (turno.resultado === "ATENDIDO") {
        atendidos++;
      } else if (turno.resultado === "AUSENTE") {
        ausentes++;
      } else if (turno.resultado === "SIN_REGISTRAR") {
        sinRegistrar++;
      }

      // Cómputo de recordatorios para citas cuyo horario ya concluyó
      if (estadoRecordatorio === "ENVIADO") {
        recordatoriosEnviados++;
      } else if (estadoRecordatorio === "FALLIDO") {
        recordatoriosFallidos++;
      } else if (estadoRecordatorio === "RESERVA_TARDIA") {
        reservaTardia++;
      } else {
        sinRecordatorio++;
      }
    }

    citasDetalle.push({
      id: turno.id.toString(),
      fecha: fechaStr,
      hora: horaStr,
      duracionMin: turno.duracionMin,
      paciente: turno.paciente.persona.nombreCompleto,
      medico: turno.disponibilidad.profesional.persona.nombreCompleto,
      especialidad:
        turno.disponibilidad.profesional.medico?.especialidad?.nombre ??
        "Consulta general",
      estado: turno.estado,
      resultado: turno.resultado,
      estadoRecordatorio,
      horarioTerminado,
    });
  }

  // CA3: Asistencia = atendidos / (atendidos + ausentes) en %
  const totalConResultado = atendidos + ausentes;
  const porcentajeAsistencia =
    totalConResultado > 0
      ? `${((atendidos / totalConResultado) * 100).toFixed(1)}%`
      : "No aplica";

  return {
    asistencia: {
      atendidos,
      ausentes,
      sinRegistrar,
      cancelados,
      futurosExcluidos,
      porcentajeAsistencia,
    },
    recordatorios: {
      enviados: recordatoriosEnviados,
      fallidos: recordatoriosFallidos,
      reservaTardia,
      sinRecordatorio,
    },
    citas: citasDetalle,
    periodo: { desde, hasta },
  };
}

/**
 * Carga el catálogo de médicos habilitados para poblar el selector de filtros.
 */
export async function obtenerMedicosParaFiltro(): Promise<OpcionSelector[]> {
  const medicos = await prisma.medico.findMany({
    where: {
      usuario: { activo: true },
    },
    select: {
      usuarioId: true,
      usuario: {
        select: {
          persona: { select: { nombreCompleto: true } },
        },
      },
    },
    orderBy: {
      usuario: {
        persona: { nombreCompleto: "asc" },
      },
    },
  });

  return medicos.map((m) => ({
    id: m.usuarioId.toString(),
    nombre: m.usuario.persona.nombreCompleto,
  }));
}

/**
 * Carga el catálogo de especialidades para poblar el selector de filtros.
 */
export async function obtenerEspecialidadesParaFiltro(): Promise<OpcionSelector[]> {
  const especialidades = await prisma.especialidad.findMany({
    select: {
      id: true,
      nombre: true,
    },
    orderBy: { nombre: "asc" },
  });

  return especialidades.map((e) => ({
    id: e.id.toString(),
    nombre: e.nombre,
  }));
}
