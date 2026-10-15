import { MSG } from "@/lib/auth/constants";

import type {
  EstadoTurnoAgenda,
  FiltrosAgenda,
  JornadaAgenda,
  ResultadoAgenda,
  TurnoAgenda,
} from "./tipos";

// Reglas reales de la agenda (US-010). No dependen de datos de demostración.

export const ZONA_SALA = "America/Argentina/Buenos_Aires";

/** Plazo mínimo de cancelación desde el portal (CA4 / RF-11): 24 horas. */
export const PLAZO_CANCELACION_MS = 24 * 60 * 60 * 1000;

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function hoySala(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_SALA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

export function esFechaValida(valor: unknown): valor is string {
  if (typeof valor !== "string" || !FORMATO_FECHA.test(valor)) return false;
  const fecha = new Date(`${valor}T12:00:00Z`);
  return (
    !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor
  );
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function sumarMeses(fecha: string, meses: number): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const primero = new Date(Date.UTC(anio, mes - 1 + meses, 1, 12));
  const anioDestino = primero.getUTCFullYear();
  const mesDestino = primero.getUTCMonth() + 1;
  const cantidad = new Date(Date.UTC(anioDestino, mesDestino, 0)).getUTCDate();
  const diaFinal = Math.min(dia, cantidad);
  return `${anioDestino}-${String(mesDestino).padStart(2, "0")}-${String(diaFinal).padStart(2, "0")}`;
}

export function diasDelMes(fechaCualquieraDelMes: string): string[] {
  const [anio, mes] = fechaCualquieraDelMes.split("-").map(Number);
  const cantidad = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return Array.from({ length: cantidad }, (_, i) => {
    const dia = String(i + 1).padStart(2, "0");
    return `${anio}-${String(mes).padStart(2, "0")}-${dia}`;
  });
}

/** "Jueves, 1 de octubre", con solo la primera letra en mayúscula. */
export function etiquetaFecha(fecha: string): string {
  const texto = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${fecha}T12:00:00Z`));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Instante absoluto de inicio de un turno, en horario de Argentina (UTC-3, sin cambio horario). */
export function inicioTurno(fecha: string, hora: string): string {
  return new Date(`${fecha}T${hora}:00-03:00`).toISOString();
}

export function leerFiltrosAgenda(
  params: Record<string, string | string[] | undefined>,
  hoy: string = hoySala(),
): FiltrosAgenda {
  const unico = (valor: string | string[] | undefined) =>
    Array.isArray(valor) ? valor[0] : valor;

  const vista = unico(params.vista) === "mes" ? "mes" : "dia";
  const fechaParam = unico(params.fecha);
  const estado = unico(params.estado);
  const resultado = unico(params.resultado);

  return {
    vista,
    fecha: esFechaValida(fechaParam) ? fechaParam : hoy,
    estado:
      estado === "reservado" ||
      estado === "confirmado" ||
      estado === "cancelado"
        ? estado
        : "todos",
    resultado:
      resultado === "sin_registrar" ||
      resultado === "atendido" ||
      resultado === "ausente"
        ? resultado
        : "todos",
  };
}

/** Un turno está pendiente de resolver si es confirmado dentro de una jornada suspendida (CA1). */
export function estaPendienteDeResolver(
  turno: TurnoAgenda,
  jornada: JornadaAgenda | undefined,
): boolean {
  return turno.estado === "CONFIRMADO" && jornada?.estado === "SUSPENDIDA";
}

/**
 * CA4: la atención se inicia desde una cita confirmada, no bloqueada,
 * cuyo horario de inicio ya llegó. Nunca desde una retención temporal.
 */
export function evaluarInicioAtencion(
  turno: TurnoAgenda,
  jornada: JornadaAgenda | undefined,
  ahora: Date = new Date(),
): { puede: boolean; motivo: string } {
  if (turno.estado === "RESERVADO") {
    return {
      puede: false,
      motivo: "Es una retención temporal, no una cita confirmada.",
    };
  }
  if (turno.estado !== "CONFIRMADO") {
    return { puede: false, motivo: "La cita está cancelada." };
  }
  if (jornada?.estado === "SUSPENDIDA") {
    return {
      puede: false,
      motivo:
        "La jornada está suspendida; la cita requiere resolución administrativa.",
    };
  }
  if (ahora < new Date(turno.inicio)) {
    return {
      puede: false,
      motivo: `Todavía no llegó el horario de inicio (${turno.hora} hs).`,
    };
  }
  return { puede: true, motivo: "" };
}

/**
 * CA4 (US-013) y CA1 (US-014): el paciente o tutor puede cancelar una cita
 * confirmada, sin atención registrada, cuando faltan 24 horas o más para su
 * inicio (plazo inclusive). `inicio` es el ISO de `inicioTurno()`.
 */
export function puedeCancelarTurno(
  turno: {
    estado: EstadoTurnoAgenda;
    inicio: string;
    resultado: ResultadoAgenda;
  },
  ahora: Date = new Date(),
): { puede: boolean; motivo: string } {
  if (turno.estado !== "CONFIRMADO") {
    return { puede: false, motivo: MSG.CANCELACION_ESTADO };
  }
  if (turno.resultado !== "SIN_REGISTRAR") {
    return { puede: false, motivo: MSG.CANCELACION_RESULTADO };
  }
  const restante = new Date(turno.inicio).getTime() - ahora.getTime();
  if (restante < PLAZO_CANCELACION_MS) {
    return { puede: false, motivo: MSG.CANCELACION_PLAZO };
  }
  return { puede: true, motivo: "" };
}

/** Hora de sala (HH:MM) de un instante absoluto. */
function horaSala(instante: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: ZONA_SALA,
  }).format(instante);
}

/** Instante de fin previsto del turno: inicio + duración. */
export function finTurno(inicio: string, duracionMin: number): Date {
  return new Date(new Date(inicio).getTime() + duracionMin * 60 * 1000);
}

/**
 * CA2, CA3 y CA4 (US-016): la ausencia se registra sobre una cita confirmada,
 * de jornada no suspendida, sin resultado previo, recién después del fin
 * previsto del turno. Reutilizada por la pantalla y por la acción de servidor
 * para que la habilitación del botón y la validación real nunca diverjan.
 */
export function evaluarRegistroAusencia(
  turno: {
    estado: EstadoTurnoAgenda;
    resultado: ResultadoAgenda;
    inicio: string;
    duracionMin: number;
  },
  jornada: JornadaAgenda | undefined,
  ahora: Date = new Date(),
): { puede: boolean; motivo: string } {
  if (turno.estado === "RESERVADO") {
    return {
      puede: false,
      motivo: "Es una retención temporal, no una cita confirmada.",
    };
  }
  if (turno.estado !== "CONFIRMADO") {
    return { puede: false, motivo: "La cita está cancelada." };
  }
  if (jornada?.estado === "SUSPENDIDA") {
    return {
      puede: false,
      motivo:
        "La jornada está suspendida; la cita requiere resolución administrativa.",
    };
  }
  if (turno.resultado !== "SIN_REGISTRAR") {
    return {
      puede: false,
      motivo: "La cita ya tiene un resultado de atención registrado.",
    };
  }
  const fin = finTurno(turno.inicio, turno.duracionMin);
  if (ahora < fin) {
    return {
      puede: false,
      motivo: `La ausencia se registra cuando termina el turno (${horaSala(fin)} hs).`,
    };
  }
  return { puede: true, motivo: "" };
}
