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
  SOLO_CUENTAS_ACTIVAS:
    "Solo se pueden restablecer cuentas que se encuentren activas.",
  PASSWORD_ACTUAL_REQUERIDO: "Ingresá tu contraseña actual.",
  PASSWORD_ACTUAL_INCORRECTO: "La contraseña actual no coincide.",
  NUEVA_REQUERIDA: "Ingresá la nueva contraseña.",
  IGUAL_A_ACTUAL: "La nueva contraseña tiene que ser distinta de la actual.",
  CAMBIO_VOLUNTARIO_EXITO: "Tu contraseña se actualizó correctamente.",
  CLAVE_TEMPORAL_GENERADA:
    "Clave temporal generada con éxito. Entregale estas credenciales en mano al solicitante.",
  DURACION_INVALIDA: "La duración debe ser un número entero mayor a 0 minutos.",
  DURACION_DECIMAL: "La duración debe ser un número entero en minutos.",
  ARANCEL_INVALIDO: "El arancel debe ser un importe mayor o igual a 0.",
  ARANCEL_DECIMALES: "El arancel admite como máximo dos decimales.",
  ARANCEL_VACUNA_INVALIDO:
    "El arancel de la vacuna debe ser un importe mayor o igual a 0.",
  CONFIGURACION_MEDICO_EXITO: "Configuración del médico actualizada con éxito.",
  CONFIGURACION_VACUNA_EXITO: "Arancel de la vacuna actualizado con éxito.",
  MEDICO_NO_ENCONTRADO:
    "El profesional médico no fue encontrado o no está activo.",
  VACUNA_NO_ENCONTRADA: "El tipo de vacuna solicitado no fue encontrado.",
  ALTA_CAMPOS_REQUERIDOS:
    "Completá nombre, apellido, DNI, fecha de nacimiento, teléfono y correo.",
  ALTA_NOMBRE_LARGO:
    "El nombre y el apellido juntos no pueden superar los 255 caracteres.",
  ALTA_DNI_INVALIDO: "Ingresá el DNI solo con números, sin puntos.",
  ALTA_TELEFONO_LARGO: "El teléfono no puede superar los 30 caracteres.",
  ALTA_FECHA_INVALIDA: "Ingresá una fecha de nacimiento válida.",
  ALTA_FECHA_FUTURA: "La fecha de nacimiento no puede ser futura.",
  ALTA_NO_ADULTO:
    "La persona es menor de 18 años. Un menor se registra vinculado a su tutor.",
  ALTA_EMAIL_INVALIDO: "Ingresá un correo electrónico válido.",
  ALTA_EMAIL_EN_USO: "Ese correo ya está registrado en otra cuenta.",
  ALTA_OBRA_SOCIAL_INVALIDA:
    "Seleccioná una obra social activa del catálogo o «Sin obra social».",
  ALTA_AFILIACION_INCOMPLETA:
    "Para registrar una obra social completá el plan y el número de afiliado.",
  ALTA_AFILIACION_LARGA:
    "El plan admite hasta 120 caracteres y el número de afiliado hasta 80.",
  ALTA_DNI_COINCIDENTE:
    "Ya hay pacientes registrados con ese DNI. Verificá la identidad y elegí cómo continuar.",
  ALTA_RESOLUCION_INVALIDA:
    "Elegí una de las opciones para el DNI coincidente.",
  ALTA_MOTIVO_REQUERIDO:
    "Para registrar otro paciente con el mismo DNI indicá el motivo de la excepción.",
  ALTA_REGISTRO_CON_CUENTA:
    "Ese registro ya tiene una cuenta. Elegí otra opción.",
  ALTA_REGISTRO_NO_ADULTO:
    "Ese registro corresponde a una persona menor de 18 años y no puede tener cuenta propia.",
  ALTA_CONFLICTO:
    "No se pudo completar la alta: el correo ya está en uso y el registro elegido ya tiene una cuenta.",
  OBRA_SOCIAL_NOMBRE_REQUERIDO: "Ingresá el nombre de la obra social.",
  OBRA_SOCIAL_NOMBRE_LARGO: "El nombre admite hasta 255 caracteres.",
  OBRA_SOCIAL_NOMBRE_DUPLICADO: "Ya existe una obra social con ese nombre.",
  OBRA_SOCIAL_NO_ENCONTRADA: "La obra social solicitada no existe.",
  OBRA_SOCIAL_CREADA: "Obra social creada con éxito.",
  OBRA_SOCIAL_NOMBRE_ACTUALIZADO: "Nombre actualizado con éxito.",
  OBRA_SOCIAL_ESTADO_ACTUALIZADO: "Estado actualizado con éxito.",
  CANCELACION_PLAZO:
    "Faltan menos de 24 horas para el inicio. Contactá a la sala para gestionarla presencialmente.",
  CANCELACION_INICIADA: "Esta cita ya empezó: no se puede cancelar.",
  CANCELACION_NO_ENCONTRADO:
    "El turno solicitado no existe o ya no está disponible para cancelar.",
  CANCELACION_ESTADO: "Solo se pueden cancelar citas confirmadas.",
  CANCELACION_RESULTADO:
    "La cita ya tiene un resultado de atención registrado y no puede cancelarse.",
  CANCELACION_EXITO: "Turno cancelado con éxito.",
  CITA_SIN_ACCESO: "No tenés acceso a esta cita.",
  CONSULTA_DIAGNOSTICO_REQUERIDO:
    "El diagnóstico es obligatorio para registrar la consulta médica.",
  CONSULTA_REGISTRADA_EXITO: "Consulta médica registrada con éxito.",
  CONSULTA_CITA_NO_DISPONIBLE:
    "La cita médica no existe o no tenés autorización para acceder a ella.",
  CONSULTA_NO_CONFIRMADA: "Solo se pueden atender citas en estado confirmada.",
  CONSULTA_JORNADA_SUSPENDIDA:
    "No se puede iniciar la atención: la jornada se encuentra suspendida.",
  CONSULTA_HORARIO_NO_ALCANZADO:
    "Todavía no llegó el horario de inicio de la cita.",
  CONSULTA_YA_ATENDIDA:
    "Esta cita ya cuenta con una consulta médica registrada.",
  CONSULTA_MARCADA_AUSENTE:
    "No se puede registrar la consulta: la cita fue marcada como ausente.",
  CONSULTA_SIN_PERMISO:
    "Tu rol no tiene permiso para documentar consultas médicas.",
  ADJUNTO_NOMBRE_REQUERIDO: "El nombre descriptivo del archivo es obligatorio.",
  ADJUNTO_NOMBRE_LARGO: "El nombre descriptivo admite hasta 255 caracteres.",
  ADJUNTO_ARCHIVO_REQUERIDO: "Seleccioná un archivo para adjuntar.",
  ADJUNTO_TIPO_INVALIDO: "Solo se permiten archivos PDF, JPG o PNG.",
  ADJUNTO_TAMANO_EXCEDIDO: "El archivo supera los 10 MB permitidos.",
  ADJUNTO_ARCHIVO_CORRUPTO: "El archivo no coincide con el formato declarado.",
  ADJUNTO_CONSULTA_NO_DISPONIBLE:
    "La consulta no existe o no tenés autorización para adjuntar archivos.",
  ADJUNTO_EXITO: "Documento adjuntado con éxito.",
  ADJUNTO_ERROR_GUARDADO: "No se pudo guardar el archivo. Intentá nuevamente.",
  ADJUNTO_SIN_PERMISO:
    "Tu rol no tiene permiso para adjuntar documentos a consultas.",
} as const;

export const AUDITORIA = {
  INICIO: "Inicio de sesión",
  CIERRE: "Cierre de sesión",
  CAMBIO_TEMPORAL: "Cambio de clave temporal",
  RESTABLECIMIENTO_ADMIN: "Restablecimiento de contraseña",
  CAMBIO_VOLUNTARIO: "Cambio voluntario de contraseña",
  CONFIGURACION_MEDICO: "Configuración de duración y arancel médico",
  CONFIGURACION_VACUNA: "Configuración de arancel de vacuna",
  ALTA_PACIENTE: "Alta de paciente adulto",
  ALTA_OBRA_SOCIAL: "Alta de obra social",
  EDICION_OBRA_SOCIAL: "Edición de obra social",
  ESTADO_OBRA_SOCIAL: "Cambio de estado de obra social",
  RESERVA_TURNO: "Reserva de turno",
  CONFIRMACION_TURNO: "Confirmación de turno",
  CANCELACION_EXPIRACION: "Cancelación por expiración de retención",
  CANCELACION_TURNO_PACIENTE: "Cancelación de turno por paciente",
  RESULTADO_AUSENCIA_MEDICA: "Registro de ausencia médica",
  RESULTADO_AUSENCIA_VACUNACION: "Registro de ausencia en vacunatorio",
  REGISTRO_CONSULTA_MEDICA: "Registro de consulta médica",
  RESOLUCION_CANCELACION_SUSPENSION:
    "Cancelación administrativa de cita afectada por suspensión",
  RESOLUCION_REPROGRAMACION_SUSPENSION:
    "Reprogramación administrativa de cita afectada por suspensión",
  RESERVA_PRESENCIAL: "Reserva presencial por personal autorizado",
  CANCELACION_PRESENCIAL: "Cancelación presencial por personal autorizado",
  REGISTRO_ADJUNTO_CONSULTA: "Registro de adjunto de consulta",
} as const;
