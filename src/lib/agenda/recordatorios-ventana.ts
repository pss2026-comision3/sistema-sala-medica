import { hoySala, inicioTurno } from "@/lib/agenda/reglas";

export type VentanaRecordatorios = {
  ahora: Date;
  hasta: Date;
  fechas: Date[];
};

/**
 * Ventana absoluta de 24 horas para recordatorios.
 *
 * No se puede comparar `Turno.hora` (columna SQL `time`) contra un `Date` en
 * Prisma/PostgreSQL. Por eso se limita por `Disponibilidad.fecha` (día de sala)
 * y luego se combina fecha + hora en JS con la zona horaria de la sala.
 */
export function construirVentanaRecordatorios(
  ahora: Date = new Date(),
  horas = 24,
): VentanaRecordatorios {
  const hasta = new Date(ahora.getTime() + horas * 60 * 60 * 1000);
  const fechas = [...new Set([hoySala(ahora), hoySala(hasta)])].map(
    (fecha) => new Date(`${fecha}T00:00:00.000Z`),
  );
  return { ahora, hasta, fechas };
}

/**
 * Variante para el cron diario de Vercel: procesa los turnos de hoy y de
 * mañana, excluyendo los que ya comenzaron. Con una sola ejecución diaria,
 * una ventana exacta de 24 h dejaría afuera los turnos de la tarde siguiente.
 */
export function construirVentanaRecordatoriosDiaria(
  ahora: Date = new Date(),
): VentanaRecordatorios {
  const hoy = hoySala(ahora);
  const manana = sumarDias(hoy, 1);
  const pasadoManana = sumarDias(hoy, 2);
  return {
    ahora,
    hasta: new Date(`${pasadoManana}T00:00:00-03:00`),
    fechas: [new Date(`${hoy}T00:00:00.000Z`), new Date(`${manana}T00:00:00.000Z`)],
  };
}

function sumarDias(fecha: string, dias: number): string {
  const base = new Date(`${fecha}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

export function inicioTurnoDesdeFechaHora(fecha: Date, hora: Date): Date {
  const dia = fecha.toISOString().slice(0, 10);
  const horaTexto = hora.toISOString().slice(11, 16);
  return new Date(inicioTurno(dia, horaTexto));
}

export function turnoEnVentana(
  fecha: Date,
  hora: Date,
  ahora: Date,
  hasta: Date,
): boolean {
  const inicio = inicioTurnoDesdeFechaHora(fecha, hora);
  return inicio > ahora && inicio <= hasta;
}
