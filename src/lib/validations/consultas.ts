import { z } from "zod";

export const esquemaAgregarCorreccion = z.object({
  turnoId: z.string().min(1, "El ID del turno es obligatorio"),
  motivo: z.string().trim().min(1, "Tenés que ingresar un motivo válido"),
  texto: z
    .string()
    .trim()
    .min(1, "El texto de la corrección no puede estar vacío"),
});
