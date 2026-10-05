import { Rol } from "@/generated/prisma/client";

export const COOKIE_SESION = "sigsam_sesion";

export const INACTIVIDAD_MS = 15 * 60 * 1000;
export const TOQUE_MS = 60 * 1000;
export const COOKIE_MAX_AGE_SEG = 12 * 60 * 60;

export const INICIO_POR_ROL: Record<Rol, string> = {
  ADMIN: "/admin",
  MEDICO: "/medico",
  ENFERMERIA: "/enfermeria",
  PACIENTE: "/paciente",
};

export const ETIQUETA_ROL: Record<Rol, string> = {
  ADMIN: "Administrador",
  MEDICO: "Médico",
  ENFERMERIA: "Enfermería",
  PACIENTE: "Paciente",
};

export const MSG = {
  EMAIL_REQUERIDO: "Ingresá tu correo.",
  PASSWORD_REQUERIDO: "Ingresá tu contraseña.",
  CREDENCIALES_INVALIDAS:
    "El correo o la contraseña no coinciden. Revisalos e intentá otra vez.",
  CUENTA_DESACTIVADA:
    "Esta cuenta está desactivada. Contactá a Administración.",
  TEMPORAL_REQUERIDA: "Ingresá la clave temporal.",
  NUEVA_CORTA: "La nueva contraseña debe tener al menos ocho caracteres.",
  REPETICION_NO_COINCIDE: "La repetición no coincide.",
  IGUAL_A_TEMPORAL:
    "La nueva contraseña tiene que ser distinta de la temporal.",
  TEMPORAL_INCORRECTA: "La clave temporal no coincide.",
  CAMPOS_RECUPERAR: "Completá el correo y la clave temporal.",
  RECUPERACION_INVALIDA:
    "La cuenta o la clave temporal no coinciden. Solicitá ayuda a Administración.",
  RECUPERACION_OK: "Clave actualizada. Ya podés iniciar sesión.",
  SIN_PERMISO: "Tu rol no tiene permiso para abrir esta pantalla.",
} as const;

export const AUDITORIA = {
  INICIO: "Inicio de sesión",
  CIERRE: "Cierre de sesión",
  CAMBIO_TEMPORAL: "Cambio de clave temporal",
} as const;
