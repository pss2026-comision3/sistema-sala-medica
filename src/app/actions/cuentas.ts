"use server";

import { esquemaCuentaPersonal } from "@/lib/validations/cuentas";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";

/*
 * Este archivo contiene acciones del lado del servidor relacionadas con la creacion de cuentas internas.
 */

export type FormState = {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
};

export async function crearCuentaPersonal(
  formData: FormData,
): Promise<FormState> {
  const admin = await requireRole("ADMIN");

  const datosForm = {
    nombre: formData.get("nombre") as string,
    apellido: formData.get("apellido") as string,
    email: formData.get("email") as string,
    claveTemporal: formData.get("claveTemporal") as string,
    rol: formData.get("rol") as string,
    especialidadId: formData.get("especialidadId") as string,
  };

  const validacion = esquemaCuentaPersonal.safeParse(datosForm);

  if (!validacion.success) {
    return {
      success: false,
      errors: validacion.error.flatten().fieldErrors,
      message: "Hay errores en el formulario. Revisalos por favor.",
    };
  }

  const { nombre, apellido, email, claveTemporal, rol, especialidadId } =
    validacion.data;

  const passwordHash = await bcrypt.hash(claveTemporal, 10);
  const emailNormalizado = email.toLowerCase();

  try {
    await prisma.$transaction(async (tx) => {
      const persona = await tx.persona.create({
        data: {
          nombreCompleto: `${nombre} ${apellido}`.trim(),
        },
      });

      const usuario = await tx.usuario.create({
        data: {
          personaId: persona.id,
          email: emailNormalizado,
          passwordHash: passwordHash,
          rol: rol,
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
          actor_id: BigInt(admin.usuarioId),
          accion: "Creación de cuenta personal",
          entidad: "usuario",
          referencia_id: usuario.id,
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

  redirect("/admin/cuentas?exito=true");
}
