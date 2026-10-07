import type { EstadoTurnoAgenda, ResultadoAgenda } from "./tipos";

export const ETIQUETA_ESTADO_CITA: Record<EstadoTurnoAgenda, string> = {
  RESERVADO: "Retención temporal",
  CONFIRMADO: "Confirmado",
  CANCELADO: "Cancelado",
};

export const ETIQUETA_RESULTADO_ATENCION: Record<ResultadoAgenda, string> = {
  SIN_REGISTRAR: "Sin resultado",
  ATENDIDO: "Atendido",
  AUSENTE: "Ausente",
};
