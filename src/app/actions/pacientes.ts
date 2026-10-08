"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AUDITORIA, MSG } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/guards";
import {
  generarClaveTemporal,
  hashearPassword,
  normalizarEmail,
} from "@/lib/auth/password";

/** Paciente existente con el mismo DNI (CA3). Solo lo ve el Administrador. */
export type CoincidenciaDni = {
  personaId: string;
  nombre: string;
  fechaNacimiento: string; // YYYY-MM-DD
  tieneCuenta: boolean;
  esAdulto: boolean;
};

export type CamposAltaPaciente = {
  nombre?: string;
  apellido?: string;
  dni?: string;
  fechaNacimiento?: string;
  telefono?: string;
  email?: string;
  obraSocialId?: string;
  plan?: string;
  numeroAfiliado?: string;
  resolucionDni?: string; // "" | "nuevo" | "usar:<personaId>"
  motivoExcepcion?: string;
};

export type EstadoAltaPaciente = {
  error?: string;
  campos?: CamposAltaPaciente;
  coincidenciasDni?: CoincidenciaDni[];
  exito?: {
    nombre: string;
    email: string;
    claveTemporal: string;
    registroExistente: boolean;
  };
};

/** Umbral de adultez del prototipo (US-002 CA1, US-003 CA5). */
const EDAD_ADULTA = 18;
/** Se usa la hora de la sala en Argentina (reglas compartidas de las USs). */
const ZONA_SALA = "America/Argentina/Buenos_Aires";

function hoyEnLaSala(): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_SALA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function esFechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    d.getUTCFullYear() === anio &&
    d.getUTCMonth() === mes - 1 &&
    d.getUTCDate() === dia
  );
}

/** Cumplió 18 años si la fecha de su cumpleaños 18 es hoy o anterior. */
function esAdulto(fechaNacimiento: string, hoy: string): boolean {
  const anio = Number(fechaNacimiento.slice(0, 4)) + EDAD_ADULTA;
  const cumple18 = `${String(anio).padStart(4, "0")}${fechaNacimiento.slice(4)}`;
  return cumple18 <= hoy;
}

/** Las columnas `date` llegan como DateTime a las 00:00 UTC (D-03). */
function aFechaIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function altaPacienteAdulto(
  _prev: EstadoAltaPaciente,
  formData: FormData,
): Promise<EstadoAltaPaciente> {
  const sesionAdmin = await requireRole("ADMIN");

  const leer = (clave: string) => String(formData.get(clave) ?? "").trim();
  const campos: CamposAltaPaciente = {
    nombre: leer("nombre"),
    apellido: leer("apellido"),
    dni: leer("dni"),
    fechaNacimiento: leer("fechaNacimiento"),
    telefono: leer("telefono"),
    email: leer("email"),
    obraSocialId: leer("obraSocialId"),
    plan: leer("plan"),
    numeroAfiliado: leer("numeroAfiliado"),
    resolucionDni: leer("resolucionDni"),
    motivoExcepcion: leer("motivoExcepcion"),
  };
  const nombre = campos.nombre ?? "";
  const apellido = campos.apellido ?? "";
  const dni = campos.dni ?? "";
  const fechaNacimiento = campos.fechaNacimiento ?? "";
  const telefono = campos.telefono ?? "";
  const plan = campos.plan ?? "";
  const numeroAfiliado = campos.numeroAfiliado ?? "";
  const resolucionDni = campos.resolucionDni ?? "";
  const motivoExcepcion = campos.motivoExcepcion ?? "";

  const conError = (
    error: string,
    extra: Partial<EstadoAltaPaciente> = {},
  ): EstadoAltaPaciente => ({ error, campos, ...extra });

  // CA1 — Datos obligatorios y fecha válida, no futura, de un adulto.
  if (
    !nombre ||
    !apellido ||
    !dni ||
    !fechaNacimiento ||
    !telefono ||
    !campos.email
  ) {
    return conError(MSG.ALTA_CAMPOS_REQUERIDOS);
  }

  const nombreCompleto = `${nombre} ${apellido}`;
  if (nombreCompleto.length > 255) return conError(MSG.ALTA_NOMBRE_LARGO);
  if (!/^\d{1,20}$/.test(dni)) return conError(MSG.ALTA_DNI_INVALIDO);
  if (telefono.length > 30) return conError(MSG.ALTA_TELEFONO_LARGO);

  if (!esFechaValida(fechaNacimiento)) {
    return conError(MSG.ALTA_FECHA_INVALIDA);
  }
  const hoy = hoyEnLaSala();
  if (fechaNacimiento > hoy) return conError(MSG.ALTA_FECHA_FUTURA);
  if (!esAdulto(fechaNacimiento, hoy)) return conError(MSG.ALTA_NO_ADULTO);

  // CA2 — Email único, ignorando mayúsculas y espacios externos (D-08).
  const email = normalizarEmail(campos.email ?? "");
  if (email.length > 255 || !EMAIL_REGEX.test(email)) {
    return conError(MSG.ALTA_EMAIL_INVALIDO);
  }
  const emailEnUso = await prisma.usuario.findUnique({
    where: { email },
    select: { id: true },
  });
  if (emailEnUso) return conError(MSG.ALTA_EMAIL_EN_USO);

  // CA4 — Cobertura opcional: obra social activa del catálogo + plan y número.
  let obraSocialId: bigint | null = null;
  if (campos.obraSocialId) {
    let idElegido: bigint;
    try {
      idElegido = BigInt(campos.obraSocialId);
    } catch {
      return conError(MSG.ALTA_OBRA_SOCIAL_INVALIDA);
    }
    const obraSocial = await prisma.obraSocial.findUnique({
      where: { id: idElegido },
      select: { activa: true },
    });
    if (!obraSocial || !obraSocial.activa) {
      return conError(MSG.ALTA_OBRA_SOCIAL_INVALIDA);
    }
    if (!plan || !numeroAfiliado) {
      return conError(MSG.ALTA_AFILIACION_INCOMPLETA);
    }
    if (plan.length > 120 || numeroAfiliado.length > 80) {
      return conError(MSG.ALTA_AFILIACION_LARGA);
    }
    obraSocialId = idElegido;
  }

  // CA3 — Coincidencia de DNI: se muestran los registros solo al Admin, que
  // usa uno tras verificar identidad o confirma otro con motivo.
  const existentes = await prisma.paciente.findMany({
    where: { dni },
    include: {
      persona: { include: { usuario: { select: { id: true } } } },
    },
    orderBy: { personaId: "asc" },
  });
  const coincidenciasDni: CoincidenciaDni[] = existentes.map((p) => {
    const fecha = aFechaIso(p.fechaNacimiento);
    return {
      personaId: p.personaId.toString(),
      nombre: p.persona.nombreCompleto,
      fechaNacimiento: fecha,
      tieneCuenta: p.persona.usuario !== null,
      esAdulto: esAdulto(fecha, hoy),
    };
  });

  let personaExistenteId: bigint | null = null;
  let excepcionDni = false;

  if (coincidenciasDni.length > 0) {
    if (!resolucionDni) {
      return conError(MSG.ALTA_DNI_COINCIDENTE, { coincidenciasDni });
    }
    if (resolucionDni === "nuevo") {
      if (!motivoExcepcion) {
        return conError(MSG.ALTA_MOTIVO_REQUERIDO, { coincidenciasDni });
      }
      excepcionDni = true;
    } else {
      const elegida = coincidenciasDni.find(
        (c) => `usar:${c.personaId}` === resolucionDni,
      );
      if (!elegida) {
        return conError(MSG.ALTA_RESOLUCION_INVALIDA, { coincidenciasDni });
      }
      if (elegida.tieneCuenta) {
        return conError(MSG.ALTA_REGISTRO_CON_CUENTA, { coincidenciasDni });
      }
      if (!elegida.esAdulto) {
        return conError(MSG.ALTA_REGISTRO_NO_ADULTO, { coincidenciasDni });
      }
      personaExistenteId = BigInt(elegida.personaId);
    }
  }

  // CA5 — Crear (o habilitar) el Usuario con rol Paciente y clave temporal.
  const claveTemporal = generarClaveTemporal();
  const passwordHash = await hashearPassword(claveTemporal);

  let nombreFinal = nombreCompleto;
  try {
    nombreFinal = await prisma.$transaction(async (tx) => {
      let personaId = personaExistenteId;
      let nombreRegistro = nombreCompleto;

      if (personaId === null) {
        const persona = await tx.persona.create({ data: { nombreCompleto } });
        await tx.paciente.create({
          data: {
            personaId: persona.id,
            dni,
            fechaNacimiento: new Date(`${fechaNacimiento}T00:00:00.000Z`),
            telefono,
            obraSocialId,
            plan: obraSocialId === null ? null : plan,
            numeroAfiliado: obraSocialId === null ? null : numeroAfiliado,
          },
        });
        personaId = persona.id;
      } else {
        const persona = await tx.persona.findUniqueOrThrow({
          where: { id: personaId },
        });
        nombreRegistro = persona.nombreCompleto;
      }

      await tx.usuario.create({
        data: {
          personaId,
          email,
          passwordHash,
          rol: "PACIENTE",
          activo: true,
          claveTemporal: true,
        },
      });

      // Nunca se registran contraseñas en la bitácora (RF-21).
      await tx.auditoria.create({
        data: {
          actorId: BigInt(sesionAdmin.usuarioId),
          accion: AUDITORIA.ALTA_PACIENTE,
          entidad: "paciente",
          referenciaId: personaId,
          detalle: JSON.stringify({
            registroExistente: personaExistenteId !== null,
            excepcionDni: excepcionDni ? { motivo: motivoExcepcion } : null,
          }),
        },
      });

      return nombreRegistro;
    });
  } catch (error) {
    // Unicidad violada por una operación simultánea (email o cuenta ya creada).
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return conError(MSG.ALTA_CONFLICTO, {
        coincidenciasDni: coincidenciasDni.length
          ? coincidenciasDni
          : undefined,
      });
    }
    throw error;
  }

  revalidatePath("/admin/pacientes");

  return {
    exito: {
      nombre: nombreFinal,
      email,
      claveTemporal,
      registroExistente: personaExistenteId !== null,
    },
  };
}


// Acción 1: Buscar tutor por DNI para el frontend
export async function buscarTutorPorDni(dni: string) {
  try {
    const paciente = await prisma.paciente.findFirst({
      where: { dni },
      include: { persona: true } // Traemos los datos de Persona para mostrar el nombre
    })

    if (!paciente) {
      return { success: false, error: "No se encontró ningún paciente con ese DNI." }
    }

    return { 
      success: true, 
      tutor: {
        id: paciente.personaId.toString(), // Convertimos BigInt a string
        nombreCompleto: paciente.persona.nombreCompleto,
        dni: paciente.dni
      }
    }
  } catch (error) {
    console.error("Error al buscar tutor:", error)
    return { success: false, error: "Error interno al buscar el tutor." }
  }
}

// Acción 2: Registrar al menor
export async function registrarMenor(prevState: any, formData: FormData) {
  const nombreCompleto = formData.get("nombreCompleto") as string
  const dni = formData.get("dni") as string
  const fechaNacimiento = formData.get("fechaNacimiento") as string
  const telefono = formData.get("telefono") as string
  const tutorId = formData.get("tutorId") as string

  if (!tutorId) {
    return { success: false, error: "Es obligatorio vincular a un tutor válido." }
  }

  try {
    const nuevaPersona = await prisma.persona.create({
      data: {
        nombreCompleto,
        paciente: {
          create: {
            dni,
            // Modificado para usar la misma sintaxis robusta de fecha que tu compañera
            fechaNacimiento: new Date(`${fechaNacimiento}T00:00:00.000Z`),
            telefono,
            tutorId: BigInt(tutorId),
          }
        }
      }
    })

    // ¡Agregamos esto para que se refresque la tabla principal que hizo ella!
    revalidatePath("/admin/pacientes")

    return { 
      success: true, 
      message: "Menor registrado correctamente.",
      pacienteId: nuevaPersona.id.toString() 
    }
  } catch (error) {
    console.error("Error al registrar menor:", error)
    return { success: false, error: "Ocurrió un error al guardar los datos." }
  }
}