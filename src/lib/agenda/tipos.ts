// Tipos de la agenda médica (US-010). Son independientes de la fuente de datos,
// así que sobreviven al reemplazo de los mocks por consultas reales.

export type EstadoTurnoAgenda = "RESERVADO" | "CONFIRMADO" | "CANCELADO";
export type ResultadoAgenda = "SIN_REGISTRAR" | "ATENDIDO" | "AUSENTE";
export type EstadoJornadaAgenda = "PUBLICADA" | "SUSPENDIDA";

export type JornadaAgenda = {
  fecha: string; // YYYY-MM-DD
  horaDesde: string; // HH:MM
  horaHasta: string; // HH:MM
  estado: EstadoJornadaAgenda;
};

export type TurnoAgenda = {
  id: string;
  fecha: string;
  hora: string; // HH:MM
  inicio: string; // ISO 8601 con el instante real de inicio
  duracionMin: number;
  estado: EstadoTurnoAgenda;
  resultado: ResultadoAgenda;
  paciente: { nombre: string; dni: string; obraSocial: string | null };
  pendienteDeResolver: boolean;
};

export type DiaAgenda = {
  fecha: string;
  jornadas: JornadaAgenda[];
  turnos: TurnoAgenda[];
};

export type FiltrosAgenda = {
  vista: "dia" | "mes";
  fecha: string;
  estado: "todos" | "reservado" | "confirmado" | "cancelado";
  resultado: "todos" | "sin_registrar" | "atendido" | "ausente";
};

export type MedicoAgenda = {
  id: string;
  nombre: string;
  especialidad: string;
};
