/**
 * Servicio de la agenda médica (US-010).
 *
 * [MOCK-US010] Hoy todas las funciones leen de mock-agenda.ts.
 * Cuando estén US-009, US-012, US-016 y US-017, reemplazar el cuerpo de estas
 * funciones por consultas Prisma. Las pantallas no deben cambiar: solo consumen
 * estas firmas. Filtros y reglas (CA1 a CA4) están en reglas.ts y se mantienen.
 */

import { MEDICOS_MOCK, generarAgendaMock } from "./mock-agenda";
import { diasDelMes, estaPendienteDeResolver } from "./reglas";
import type {
  DiaAgenda,
  FiltrosAgenda,
  JornadaAgenda,
  MedicoAgenda,
  TurnoAgenda,
} from "./tipos";

// [MOCK-US010] Lista de médicos para el selector de administración (CA5).
export async function listarMedicosAgenda(): Promise<MedicoAgenda[]> {
  return MEDICOS_MOCK;
}

// CA2: la agenda muestra únicamente las citas del médico indicado.
export async function obtenerAgendaMedico({
  medicoId,
  filtros,
}: {
  medicoId: string;
  filtros: FiltrosAgenda;
}): Promise<DiaAgenda[]> {
  // [MOCK-US010] Datos de demostración para el médico.
  const { jornadas, turnos } = generarAgendaMock(medicoId);
  const fechas =
    filtros.vista === "mes" ? diasDelMes(filtros.fecha) : [filtros.fecha];

  const dias: DiaAgenda[] = [];
  for (const fecha of fechas) {
    const jornadasDia = jornadas.filter((j) => j.fecha === fecha);
    const turnosDia = turnos
      .filter((t) => t.fecha === fecha)
      .filter(
        (t) =>
          filtros.estado === "todos" ||
          t.estado.toLowerCase() === filtros.estado,
      )
      .filter(
        (t) =>
          filtros.resultado === "todos" ||
          t.resultado.toLowerCase() === filtros.resultado,
      )
      .map((t) => ({
        ...t,
        pendienteDeResolver: estaPendienteDeResolver(t, jornadasDia[0]),
      }));

    // En vista de día siempre se muestra la fecha; en vista de mes solo los días con contenido.
    if (
      filtros.vista === "dia" ||
      jornadasDia.length > 0 ||
      turnosDia.length > 0
    ) {
      dias.push({ fecha, jornadas: jornadasDia, turnos: turnosDia });
    }
  }
  return dias;
}

// CA3 y CA4: solo devuelve citas que pertenecen al médico indicado.
export async function obtenerTurnoMedico({
  medicoId,
  turnoId,
}: {
  medicoId: string;
  turnoId: string;
}): Promise<{ turno: TurnoAgenda; jornada: JornadaAgenda | undefined } | null> {
  // [MOCK-US010] Si el turno no es del médico, no aparece en su agenda mock y devuelve null.
  const { jornadas, turnos } = generarAgendaMock(medicoId);
  const turno = turnos.find((t) => t.id === turnoId);
  if (!turno) return null;

  const jornada = jornadas.find((j) => j.fecha === turno.fecha);
  return {
    turno: {
      ...turno,
      pendienteDeResolver: estaPendienteDeResolver(turno, jornada),
    },
    jornada,
  };
}
