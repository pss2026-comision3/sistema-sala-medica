/**
 * [MOCK-US010] DATOS DE DEMOSTRACIÓN. NO SON DATOS REALES.
 *
 * Reemplaza temporalmente lo que todavía no existe en el proyecto:
 *  - US-009: jornadas suspendidas (acá se simulan con una jornada SUSPENDIDA).
 *  - US-012: turnos reservados y confirmados (acá se generan en memoria).
 *  - US-016: resultado de atención (acá se simula ATENDIDO / AUSENTE).
 *  - US-017: consultas clínicas (no hay datos clínicos en este archivo).
 *
 * Cómo eliminarlo cuando esas US estén implementadas:
 *  1. Borrar este archivo.
 *  2. Reemplazar el cuerpo de las funciones de src/lib/agenda/servicio-agenda.ts
 *     por consultas Prisma a las tablas `disponibilidad` y `turno`.
 *  3. Buscar "MOCK-US010" en el proyecto y quitar los avisos de demostración.
 */

import type {
  EstadoTurnoAgenda,
  JornadaAgenda,
  MedicoAgenda,
  ResultadoAgenda,
  TurnoAgenda,
} from "./tipos";
import { hoySala, inicioTurno, sumarDias } from "./reglas";

// [MOCK-US010] Médicos de ejemplo para la vista de administración (CA5).
export const MEDICOS_MOCK: MedicoAgenda[] = [
  { id: "mock-1", nombre: "Dra. Ana Torres", especialidad: "Clínica" },
  { id: "mock-2", nombre: "Dr. Diego Peralta", especialidad: "Pediatría" },
  { id: "mock-3", nombre: "Dra. Paula Castro", especialidad: "Traumatología" },
];

// [MOCK-US010] Pacientes ficticios.
const PACIENTES_MOCK = [
  { nombre: "Lucía Fernández", obraSocial: "Obra social A" },
  { nombre: "Mateo Sosa", obraSocial: null },
  { nombre: "Valentina Ruiz", obraSocial: "Obra social B" },
  { nombre: "Tomás Acosta", obraSocial: null },
  { nombre: "Camila Ibarra", obraSocial: "Obra social C" },
  { nombre: "Joaquín Molina", obraSocial: null },
  { nombre: "Sofía Benítez", obraSocial: "Obra social A" },
  { nombre: "Bruno Herrera", obraSocial: null },
];

// [MOCK-US010] Agenda de ejemplo: atención lunes y jueves de 08:00 a 12:00, cupos de 20 minutos.
const DIAS_RANGO_DESDE = -40;
const DIAS_RANGO_HASTA = 45;
const DIAS_ATENCION = [1, 4]; // lunes y jueves
const HORA_DESDE_MIN = 8 * 60;
const HORA_HASTA_MIN = 12 * 60;
const DURACION_MIN = 20;

function horaDesdeMinutos(minutos: number): string {
  const h = String(Math.floor(minutos / 60)).padStart(2, "0");
  const m = String(minutos % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function semillaMedico(medicoId: string): number {
  return [...medicoId].reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

/** [MOCK-US010] Genera jornadas y turnos determinísticos para un médico. */
export function generarAgendaMock(medicoId: string): {
  jornadas: JornadaAgenda[];
  turnos: TurnoAgenda[];
} {
  const hoy = hoySala();
  const jornadas: JornadaAgenda[] = [];
  const turnos: TurnoAgenda[] = [];
  const semilla = semillaMedico(medicoId);

  let jornadasFuturas = 0;
  for (let offset = DIAS_RANGO_DESDE; offset <= DIAS_RANGO_HASTA; offset++) {
    const fecha = sumarDias(hoy, offset);
    const diaSemana = new Date(`${fecha}T12:00:00Z`).getUTCDay();
    if (!DIAS_ATENCION.includes(diaSemana)) continue;

    // [MOCK-US010] La segunda jornada publicada desde hoy aparece suspendida (simula US-009).
    const esFutura = fecha >= hoy;
    if (esFutura) jornadasFuturas++;
    const suspendida = esFutura && jornadasFuturas === 2;

    jornadas.push({
      fecha,
      horaDesde: horaDesdeMinutos(HORA_DESDE_MIN),
      horaHasta: horaDesdeMinutos(HORA_HASTA_MIN),
      estado: suspendida ? "SUSPENDIDA" : "PUBLICADA",
    });

    let indiceCupo = 0;
    for (
      let min = HORA_DESDE_MIN;
      min + DURACION_MIN <= HORA_HASTA_MIN;
      min += DURACION_MIN
    ) {
      const hora = horaDesdeMinutos(min);
      // Índice de día sin negativos: las fechas anteriores a hoy darían un seed negativo.
      const seed = semilla + (offset - DIAS_RANGO_DESDE) * 7 + indiceCupo * 3;
      indiceCupo++;

      let estado: EstadoTurnoAgenda = "CONFIRMADO";
      if (seed % 10 === 3) estado = "CANCELADO";
      if (seed % 10 === 7 && esFutura) estado = "RESERVADO";

      let resultado: ResultadoAgenda = "SIN_REGISTRAR";
      if (estado === "CONFIRMADO" && fecha < hoy) {
        if (seed % 3 === 0) resultado = "ATENDIDO";
        if (seed % 3 === 1) resultado = "AUSENTE";
      }

      const paciente = PACIENTES_MOCK[seed % PACIENTES_MOCK.length];
      turnos.push({
        id: `${medicoId}-${fecha}-${hora.replace(":", "")}`,
        fecha,
        hora,
        inicio: inicioTurno(fecha, hora),
        duracionMin: DURACION_MIN,
        estado,
        resultado,
        paciente: {
          nombre: paciente.nombre,
          dni: String(30_000_000 + ((seed * 9973) % 20_000_000)),
          obraSocial: paciente.obraSocial,
        },
        pendienteDeResolver: false, // se calcula en el servicio con estaPendienteDeResolver
      });
    }
  }

  return { jornadas, turnos };
}
