"use server";

import {
  esquemaCuentaPersonal,
  esquemaDesactivarCuenta,
} from "@/lib/validations/cuentas";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { Rol } from "@/generated/prisma/client";

/*
 * Este archivo contiene acciones del lado del servidor relacionadas con la creacion de cuentas internas.
 */

export type FormState = {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
};

export async function crearCuentaPersonal(
  prevData: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireRole("ADMIN");

  // TODO: Generar una clave temporal aleatoria.
  const claveTemporal = "password123";

  const datosForm = {
    nombreCompleto: formData.get("nombreCompleto") as string,
    email: formData.get("email") as string,
    rol: formData.get("rol") as string,
    especialidadId: (formData.get("especialidadId") as string) || undefined,
  };

  const validacion = esquemaCuentaPersonal.safeParse(datosForm);

  if (!validacion.success) {
    return {
      success: false,
      errors: validacion.error.flatten().fieldErrors,
      message: "Hay errores en el formulario. Revisalos por favor.",
    };
  }

  const { nombreCompleto, email, rol, especialidadId } = validacion.data;

  const passwordHash = await bcrypt.hash(claveTemporal, 10);
  const emailNormalizado = email.toLowerCase();

  try {
    await prisma.$transaction(async (tx) => {
      const persona = await tx.persona.create({
        data: {
          nombreCompleto: nombreCompleto,
        },
      });

      const usuario = await tx.usuario.create({
        data: {
          personaId: persona.id,
          email: emailNormalizado,
          passwordHash: passwordHash,
          rol: rol as Rol,
          activo: true,
          claveTemporal: true,
        },
      });

      if (rol === "MEDICO" && especialidadId) {
        await tx.medico.create({
          data: {
            usuarioId: usuario.id,
            especialidadId: BigInt(especialidadId),
            duracionTurnoMin: 30,
            arancelActual: 0,
          },
        });
      }

      await tx.auditoria.create({
        data: {
          actorId: BigInt(admin.usuarioId),
          accion: "Creación de cuenta personal",
          entidad: "usuario",
          referenciaId: usuario.id,
          detalle: `Rol asignado: ${rol}`,
        },
      });
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      return {
        success: false,
        message: "Ese correo electrónico ya está registrado en el sistema.",
        errors: { email: ["El email ya está en uso"] },
      };
    }

    console.error("Error al crear cuenta:", error);
    return {
      success: false,
      message: "Ocurrió un error interno al intentar guardar la cuenta.",
    };
  }

  return {
    success: true,
    message: "La cuenta de personal se creó correctamente.",
  };
}

export async function desactivarCuentaPersonal(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireRole("ADMIN");

  const datosForm = {
    usuarioId: formData.get("usuarioId") as string,
    motivo: formData.get("motivo") as string,
  };

  const validacion = esquemaDesactivarCuenta.safeParse(datosForm);

  if (!validacion.success) {
    return {
      success: false,
      errors: validacion.error.flatten().fieldErrors,
      message: "Revisá los datos ingresados.",
    };
  }

  const { usuarioId, motivo } = validacion.data;
  const idObjetivo = BigInt(usuarioId);

  try {
    await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.findUnique({
        where: { id: idObjetivo },
        include: { persona: true },
      });

      if (!usuario || !usuario.activo) {
        throw new Error("NO_EXISTE");
      }

      // CA2: Evitar borrar el último administrador activo
      if (usuario.rol === "ADMIN") {
        const adminsActivos = await tx.usuario.count({
          where: { rol: "ADMIN", activo: true },
        });
        if (adminsActivos <= 1) {
          throw new Error("ULTIMO_ADMIN");
        }
      }

      // CA4: Control de Médicos (turnos futuros confirmados o pasados sin registrar)
      if (usuario.rol === "MEDICO") {
        const turnosPendientes = await tx.turno.findMany({
          where: {
            disponibilidad: { profesionalId: idObjetivo },
            estado: "CONFIRMADO",
            resultado: "SIN_REGISTRAR",
          },
        });

        if (turnosPendientes.length > 0) {
          const idsTurnos = turnosPendientes
            .map((t) => t.id.toString())
            .join(", ");
          throw new Error(`MEDICO_CON_TURNOS|${idsTurnos}`);
        }
      }

      // CA4: Control de Enfermería (última cuenta con vacunas pendientes)
      if (usuario.rol === "ENFERMERIA") {
        const enfermerosActivos = await tx.usuario.count({
          where: { rol: "ENFERMERIA", activo: true },
        });

        if (enfermerosActivos <= 1) {
          const vacunasPendientes = await tx.turno.count({
            where: {
              tipo: "VACUNACION",
              estado: "CONFIRMADO",
              resultado: "SIN_REGISTRAR",
            },
          });
          if (vacunasPendientes > 0) {
            throw new Error("ULTIMO_ENFERMERO_CON_TURNOS");
          }
        }
      }

      // CA3: Control de Pacientes / Tutores
      const tutorados = await tx.paciente.findMany({
        where: { tutorId: usuario.personaId },
      });
      if (tutorados.length > 0) {
        const nombresTutorados = tutorados.map((t) => t.dni).join(", ");
        throw new Error(`ES_TUTOR|${nombresTutorados}`);
      }

      // Verificamos si tiene turnos futuros
      const ahora = new Date();
      const turnosFuturosPaciente = await tx.turno.findMany({
        where: {
          pacienteId: usuario.personaId,
          estado: "CONFIRMADO",
          disponibilidad: {
            fecha: { gte: ahora },
          },
        },
      });
      if (turnosFuturosPaciente.length > 0) {
        const idsTurnos = turnosFuturosPaciente
          .map((t) => t.id.toString())
          .join(", ");
        throw new Error(`PACIENTE_CON_TURNOS|${idsTurnos}`);
      }

      await tx.usuario.update({
        where: { id: idObjetivo },
        data: { activo: false },
      });

      await tx.sesion.updateMany({
        where: { usuarioId: idObjetivo, finalizadaEn: null },
        data: { finalizadaEn: new Date() },
      });

      await tx.turno.updateMany({
        where: { pacienteId: usuario.personaId, estado: "RESERVADO" },
        data: {
          estado: "CANCELADO",
          motivoCancelacion: "Cuenta desactivada",
          canceladoEn: new Date(),
        },
      });

      await tx.auditoria.create({
        data: {
          actorId: BigInt(admin.usuarioId),
          accion: "Desactivación de cuenta",
          entidad: "usuario",
          referenciaId: idObjetivo,
          detalle: `Motivo: ${motivo}`,
        },
      });
    });
  } catch (error: any) {
    const msg = error.message;
    if (msg === "ULTIMO_ADMIN")
      return {
        success: false,
        message: "No podés desactivar la última cuenta Administrador activa.",
      };
    if (msg.startsWith("MEDICO_CON_TURNOS")) {
      const turnos = msg.split("|")[1];
      return {
        success: false,
        message: `El médico tiene turnos pendientes de resolución: ${turnos}`,
      };
    }
    if (msg === "ULTIMO_ENFERMERO_CON_TURNOS")
      return {
        success: false,
        message:
          "No podés desactivarlo: es el único personal de enfermería y hay vacunas pendientes.",
      };
    if (msg.startsWith("ES_TUTOR")) {
      const dnis = msg.split("|")[1];
      return {
        success: false,
        message: `No se puede desactivar porque es tutor de los DNI: ${dnis}. Reasignalos primero.`,
      };
    }
    if (msg.startsWith("PACIENTE_CON_TURNOS")) {
      const turnos = msg.split("|")[1];
      return {
        success: false,
        message: `El paciente tiene turnos futuros confirmados: ${turnos}. Cancelalos antes de desactivar.`,
      };
    }
    if (msg === "NO_EXISTE")
      return {
        success: false,
        message: "La cuenta no existe o ya estaba desactivada.",
      };

    console.error("Error al desactivar cuenta:", error);
    return {
      success: false,
      message: "Ocurrió un error interno al intentar desactivar la cuenta.",
    };
  }

  return {
    success: true,
    message: "La cuenta fue desactivada y sus sesiones cerradas.",
  };
}
