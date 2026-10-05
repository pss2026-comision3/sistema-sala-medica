import { z } from "zod";

/*
 * Este archivo contiene las validaciones para la creación de cuentas internas en el sistema.
 */

export const esquemaCuentaPersonal = z
  .object({
    nombre: z.string().trim().min(1, "El nombre es obligatorio."),
    apellido: z.string().trim().min(1, "El apellido es obligatorio."),
    email: z.string().trim().email("Ingresá un correo válido."),
    claveTemporal: z.string().min(8, "La clave temporal es obligatoria."),
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
