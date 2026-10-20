/**
 * US-SIG-015 — Gestionar solicitudes presenciales y reprogramaciones.
 *
 * Reglas puras (sin Prisma ni Next.js) que comparten la reserva presencial
 * (CA1/CA2) y la reprogramación de citas de jornadas suspendidas (CA4): qué
 * horarios de una jornada se pueden ofrecer y validar, y qué registro
 * Paciente está habilitado para reservar.
 */

import { inicioTurno } from "./reglas";
import { estaRetencionVigente } from "./reservas";
import type { EstadoTurnoAgenda } from "./tipos";

export const MSG_PRESENCIAL = {
  FECHA_PASADA: "Elegí la fecha de hoy o una posterior.",
  HORARIO_NO_VALIDO: "Ese horario no corresponde a un turno de la jornada.",
  HORARIO_PASADO: "Ese horario ya pasó. Elegí uno posterior.",
  HORARIO_OCUPADO: "Ese horario ya no está disponible. Elegí otro.",
  SUPERPOSICION_PACIENTE:
    "El paciente ya tiene otro turno que se superpone con ese horario.",
  LIMITE_ESPECIALIDAD:
    "El paciente ya tiene un turno vigente de esta especialidad. Cancelalo antes de reservar otro.",
  LIMITE_ESPECIALIDAD_PENDIENTE:
    "El paciente tiene una cita de esta especialidad pendiente de resolución por una jornada suspendida. Administración debe reprogramarla o cancelarla desde Jornadas.",
  LIMITE_ESPECIALIDAD_REPROGRAMACION:
    "El paciente ya tiene otro turno vigente de esta especialidad: no se puede reprogramar a uno nuevo.",
  CITA_SUSPENDIDA:
    "Esta cita pertenece a una jornada suspendida: la resuelve Administración desde Jornadas.",
  NO_HABILITADO_SIN_CUENTA: "El paciente no tiene una cuenta de Paciente.",
  NO_HABILITADO_DESACTIVADO: "La cuenta del paciente está desactivada.",
  NO_HABILITADO_SIN_TUTOR: "El menor no tiene un tutor principal vigente.",
  NO_HABILITADO_MAYOR_SIN_CUENTA:
    "Cumplió 18 años y todavía no tiene cuenta propia.",
} as const;

const EDAD_ADULTA = 18;

/** Rango ocupado de un turno, en minutos desde las 00:00 (`hasta` excluido). */
export type Intervalo = { desde: number; hasta: number };

/** "HH:MM" → minutos desde las 00:00, o `null` si el formato no es válido. */
export function minutosDeHora(hora: string): number | null {
  const partes = /^(\d{2}):(\d{2})$/.exec(hora);
  if (!partes) return null;
  const horas = Number(partes[1]);
  const minutos = Number(partes[2]);
  if (horas > 23 || minutos > 59) return null;
  return horas * 60 + minutos;
}

export function horaDeMinutos(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function seSuperponen(a: Intervalo, b: Intervalo): boolean {
  return a.desde < b.hasta && b.desde < a.hasta;
}

/**
 * Un turno ocupa su horario si está confirmado o si es una retención
 * temporal todavía vigente. Una retención vencida no bloquea el cupo.
 */
export function ocupaCupo(
  turno: { estado: EstadoTurnoAgenda; retenidoHasta: Date | null },
  ahora: Date = new Date(),
): boolean {
  return (
    turno.estado === "CONFIRMADO" ||
    (turno.estado === "RESERVADO" &&
      estaRetencionVigente(turno.retenidoHasta, ahora))
  );
}

/**
 * Inicios de turno de una jornada: cada `duracionMin` desde `horaDesde`,
 * mientras el turno entre completo antes de `horaHasta` (misma grilla que
 * ofrece el autoservicio en `buscarHorariosEnFechas`).
 */
export function grillaJornada(
  horaDesde: string,
  horaHasta: string,
  duracionMin: number,
): string[] {
  const desde = minutosDeHora(horaDesde);
  const hasta = minutosDeHora(horaHasta);
  if (desde === null || hasta === null || duracionMin <= 0) return [];
  const horarios: string[] = [];
  for (
    let inicio = desde;
    inicio + duracionMin <= hasta;
    inicio += duracionMin
  ) {
    horarios.push(horaDeMinutos(inicio));
  }
  return horarios;
}

export type JornadaParaHorarios = {
  fecha: string; // YYYY-MM-DD
  horaDesde: string; // HH:MM
  horaHasta: string; // HH:MM
  duracionMin: number;
  ahora: Date;
  ocupadosMedico: Intervalo[];
  ocupadosPaciente: Intervalo[];
};

/**
 * CA2/CA4: un horario se puede reservar o reprogramar si es un inicio de la
 * grilla de la jornada, todavía no empezó y no se superpone con otro turno
 * del médico ni del paciente.
 */
export function validarHorarioPresencial(
  input: JornadaParaHorarios & { hora: string },
): { ok: true } | { error: string } {
  const { fecha, hora, horaDesde, horaHasta, duracionMin, ahora } = input;
  if (!grillaJornada(horaDesde, horaHasta, duracionMin).includes(hora)) {
    return { error: MSG_PRESENCIAL.HORARIO_NO_VALIDO };
  }
  if (new Date(inicioTurno(fecha, hora)) <= ahora) {
    return { error: MSG_PRESENCIAL.HORARIO_PASADO };
  }
  const desde = minutosDeHora(hora)!;
  const pedido = { desde, hasta: desde + duracionMin };
  if (input.ocupadosMedico.some((o) => seSuperponen(pedido, o))) {
    return { error: MSG_PRESENCIAL.HORARIO_OCUPADO };
  }
  if (input.ocupadosPaciente.some((o) => seSuperponen(pedido, o))) {
    return { error: MSG_PRESENCIAL.SUPERPOSICION_PACIENTE };
  }
  return { ok: true };
}

/** Horarios de la jornada que pasan `validarHorarioPresencial`, para ofrecerlos en pantalla. */
export function horariosLibresPresencial(input: JornadaParaHorarios): string[] {
  return grillaJornada(
    input.horaDesde,
    input.horaHasta,
    input.duracionMin,
  ).filter((hora) => "ok" in validarHorarioPresencial({ ...input, hora }));
}

/** Cumplió 18 años si su cumpleaños 18 es hoy o anterior (mismo criterio que el alta de pacientes). */
export function esAdulto(fechaNacimiento: string, hoy: string): boolean {
  const anio = Number(fechaNacimiento.slice(0, 4)) + EDAD_ADULTA;
  const cumple18 = `${String(anio).padStart(4, "0")}${fechaNacimiento.slice(4)}`;
  return cumple18 <= hoy;
}

type CuentaPaciente = { rol: string; activo: boolean } | null;

/**
 * CA1: solo se reserva para registros Paciente habilitados. Un adulto lo
 * está con su propia cuenta Paciente activa (US-002); un menor, con un tutor
 * principal vigente, es decir, adulto con cuenta Paciente activa (US-003).
 */
export function evaluarHabilitacionPaciente(
  paciente: {
    fechaNacimiento: string; // YYYY-MM-DD
    usuario: CuentaPaciente;
    tutor: { fechaNacimiento: string; usuario: CuentaPaciente } | null;
  },
  hoy: string,
): { habilitado: true } | { habilitado: false; motivo: string } {
  const { usuario, tutor } = paciente;
  if (usuario) {
    if (usuario.rol !== "PACIENTE") {
      return {
        habilitado: false,
        motivo: MSG_PRESENCIAL.NO_HABILITADO_SIN_CUENTA,
      };
    }
    if (!usuario.activo) {
      return {
        habilitado: false,
        motivo: MSG_PRESENCIAL.NO_HABILITADO_DESACTIVADO,
      };
    }
    return { habilitado: true };
  }

  if (!esAdulto(paciente.fechaNacimiento, hoy)) {
    const tutorVigente =
      !!tutor &&
      esAdulto(tutor.fechaNacimiento, hoy) &&
      tutor.usuario?.rol === "PACIENTE" &&
      tutor.usuario.activo;
    return tutorVigente
      ? { habilitado: true }
      : { habilitado: false, motivo: MSG_PRESENCIAL.NO_HABILITADO_SIN_TUTOR };
  }

  return {
    habilitado: false,
    motivo: tutor
      ? MSG_PRESENCIAL.NO_HABILITADO_MAYOR_SIN_CUENTA
      : MSG_PRESENCIAL.NO_HABILITADO_SIN_CUENTA,
  };
}
