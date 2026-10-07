import { z } from "zod";

/*
 * Este archivo contiene las validaciones para la creación de cuentas internas en el sistema.
 */

export const esquemaCuentaPersonal = z
  .object({
    nombreCompleto: z.string().trim().min(1, "El nombre es obligatorio."),
    email: z.string().trim().email("Ingresá un correo válido."),
    rol: z.enum(["ADMIN", "MEDICO", "ENFERMERIA"], {
      error: "El rol es obligatorio o no es válido.",
    }),
    especialidadId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.rol === "MEDICO" && !data.especialidadId) {
      ctx.addIssue({
        code: "custom",
        path: ["especialidadId"],
        message: "Tenés que seleccionar una especialidad para el rol Médico.",
      });
    }
  });

export const esquemaDesactivarCuenta = z.object({
  usuarioId: z.string().min(1, "Falta el ID del usuario."),
  motivo: z
    .string()
    .trim()
    .min(5, "El motivo es obligatorio (mínimo 5 caracteres)."),
});
