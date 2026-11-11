"use server";

import {
  esquemaCuentaPersonal,
  esquemaDesactivarCuenta,
} from "@/lib/validations/cuentas";
import { requireRole } from "@/lib/auth/guards";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { Prisma, Rol } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { hoySala } from "@/lib/agenda/reglas";
/*
 * Este archivo contiene acciones del lado del servidor relacionadas con la creacion de cuentas internas.
 */

/** Lo que se escribió en el formulario de alta, para no perderlo si hay un error. */
export type ValoresCuentaPersonal = {
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
  especialidadId: string;
};

export type FormState = {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  valores?: ValoresCuentaPersonal;
};

export async function crearCuentaPersonal(
  prevData: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireRole("ADMIN");

  // TODO: Generar una clave temporal aleatoria y enviarla al mail o mostrarla en pantalla.
  const claveTemporal = "password123";

  const datosForm = {
    nombre: (formData.get("nombre") as string) ?? "",
    apellido: (formData.get("apellido") as string) ?? "",
    email: formData.get("email") as string,
    rol: formData.get("rol") as string,
    especialidadId: (formData.get("especialidadId") as string) || undefined,
  };

  // Se devuelven en cada error para que el formulario no se vacíe.
  const valores: ValoresCuentaPersonal = {
    nombre: datosForm.nombre,
    apellido: datosForm.apellido,
    email: datosForm.email ?? "",
    rol: datosForm.rol ?? "",
    especialidadId: datosForm.especialidadId ?? "",
  };

  const validacion = esquemaCuentaPersonal.safeParse(datosForm);

  if (!validacion.success) {
    return {
      success: false,
      errors: validacion.error.flatten().fieldErrors,
      message: "Hay errores en el formulario. Revisalos por favor.",
      valores,
    };
  }

  const { nombre, apellido, email, rol, especialidadId } = validacion.data;
  // Mismo formato que el alta de pacientes: "Nombre Apellido" en persona.nombre_completo.
  const nombreCompleto = `${nombre} ${apellido}`;

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
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        message: "Ese correo electrónico ya está registrado en el sistema.",
        errors: { email: ["El email ya está en uso"] },
        valores,
      };
    }

    console.error("Error al crear cuenta:", error);
    return {
      success: false,
      message: "Ocurrió un error interno al intentar guardar la cuenta.",
      valores,
    };
  }

  revalidatePath("/admin");
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
      errors: {
        ...validacion.error.flatten().fieldErrors,
        usuarioId: [datosForm.usuarioId],
      },
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

      const motivosBloqueo: string[] = [];

      // CA2: Evitar borrar el último administrador activo
      if (usuario.rol === "ADMIN") {
        const adminsActivos = await tx.usuario.count({
          where: { rol: "ADMIN", activo: true },
        });
        if (adminsActivos <= 1) {
          motivosBloqueo.push(
            "No podés desactivar la última cuenta Administrador activa.",
          );
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
            .map((t) => `#${t.id}`)
            .join(", ");
          motivosBloqueo.push(
            `El médico tiene turnos pendientes de resolución (IDs: ${idsTurnos}).`,
          );
        }

        // Cancelamos las retenciones temporales sobre disponibilidad del médico (CA5)
        await tx.turno.updateMany({
          where: {
            disponibilidad: { profesionalId: idObjetivo },
            estado: "RESERVADO",
          },
          data: {
            estado: "CANCELADO",
            motivoCancelacion: "Cuenta del profesional desactivada",
            canceladoEn: new Date(),
          },
        });
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
            motivosBloqueo.push(
              "Es el único personal de enfermería y hay vacunas pendientes.",
            );
          }
        }
      }

      // CA3: Control de Pacientes / Tutores
      const tutorados = await tx.paciente.findMany({
        where: { tutorId: usuario.personaId },
        include: { persona: true },
      });
      if (tutorados.length > 0) {
        const nombresTutorados = tutorados
          .map((t) => `${t.persona.nombreCompleto} (DNI: ${t.dni})`)
          .join(", ");
        motivosBloqueo.push(
          `Es tutor de los pacientes: ${nombresTutorados}. Reasignalos primero.`,
        );
      }

      // Verificamos si tiene turnos futuros
      const ahora = new Date();
      const hoyStr = hoySala(ahora);
      const hoyDate = new Date(`${hoyStr}T00:00:00.000Z`);
      const turnosFuturosPaciente = await tx.turno.findMany({
        where: {
          pacienteId: usuario.personaId,
          estado: "CONFIRMADO",
          disponibilidad: {
            fecha: { gte: hoyDate },
          },
        },
        include: {
          disponibilidad: true,
        },
      });

      const turnosBloqueantes = turnosFuturosPaciente.filter((t) => {
        const fechaStr = t.disponibilidad.fecha.toISOString().slice(0, 10);
        if (fechaStr > hoyStr) return true;
        const horaTurno = t.hora.toISOString().slice(11, 16);
        const horaActual = ahora.toISOString().slice(11, 16);
        return horaTurno >= horaActual || t.resultado === "SIN_REGISTRAR";
      });

      if (turnosBloqueantes.length > 0) {
        const idsTurnos = turnosBloqueantes
          .map((t) => `#${t.id}`)
          .join(", ");
        motivosBloqueo.push(
          `El paciente tiene turnos confirmados pendientes (${idsTurnos}). Cancelalos antes de desactivar.`,
        );
      }

      if (motivosBloqueo.length > 0) {
        throw new Error(`BLOQUEO_MULTIPLE|${JSON.stringify(motivosBloqueo)}`);
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";

    if (msg === "NO_EXISTE") {
      return {
        success: false,
        message: "La cuenta no existe o ya estaba desactivada.",
        errors: { usuarioId: [usuarioId] },
      };
    }

    if (msg?.startsWith("BLOQUEO_MULTIPLE|")) {
      const arrayString = msg.split("|")[1];
      const motivos: string[] = JSON.parse(arrayString);

      return {
        success: false,
        message: "Revisá los siguientes bloqueos:",
        errors: {
          bloqueos: motivos,
          usuarioId: [usuarioId],
        },
      };
    }

    console.error("Error al desactivar cuenta:", error);
    return {
      success: false,
      message: "Ocurrió un error interno al intentar desactivar la cuenta.",
      errors: { usuarioId: [usuarioId] },
    };
  }

  revalidatePath("/admin");
  return {
    success: true,
    message: "La cuenta fue desactivada y sus sesiones cerradas.",
  };
}

export async function reactivarCuentaPersonal(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const usuarioId = formData.get("usuarioId") as string;

  if (!usuarioId) {
    return {
      success: false,
      message: "No se proporcionó el ID de usuario.",
    };
  }

  const idObjetivo = BigInt(usuarioId);

  try {
    await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.findUnique({
        where: { id: idObjetivo },
      });

      if (!usuario || usuario.activo) {
        throw new Error("ESTADO_INVALIDO");
      }

      await tx.usuario.update({
        where: { id: idObjetivo },
        data: { activo: true },
      });

      await tx.auditoria.create({
        data: {
          actorId: BigInt(admin.usuarioId),
          accion: "Reactivación de cuenta",
          entidad: "usuario",
          referenciaId: idObjetivo,
          detalle: "Reactivación manual desde el panel de administración",
        },
      });
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "ESTADO_INVALIDO") {
      return {
        success: false,
        message: "La cuenta no existe o ya se encuentra activa.",
      };
    }

    console.error("Error al reactivar cuenta:", error);
    return {
      success: false,
      message: "Ocurrió un error interno al intentar reactivar la cuenta.",
    };
  }

  // Refresca los datos en la página actual
  revalidatePath("/admin");

  return {
    success: true,
    message: "La cuenta fue reactivada exitosamente.",
  };
}
