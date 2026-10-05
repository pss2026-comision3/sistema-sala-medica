"use server";

import { esquemaCuentaPersonal } from "@/lib/validations/cuentas";
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
