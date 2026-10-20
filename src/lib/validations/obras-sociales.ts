import { z } from "zod";

import { MSG } from "@/lib/auth/constants";

const idObraSocial = z
  .string()
  .regex(/^[1-9]\d*$/, MSG.OBRA_SOCIAL_NO_ENCONTRADA);

const nombreObraSocial = z
  .string()
  .trim()
  .min(1, MSG.OBRA_SOCIAL_NOMBRE_REQUERIDO)
  .max(255, MSG.OBRA_SOCIAL_NOMBRE_LARGO);

export const esquemaCrearObraSocial = z.object({
  nombre: nombreObraSocial,
});

export const esquemaEditarObraSocial = z.object({
  id: idObraSocial,
  nombre: nombreObraSocial,
});

export const esquemaEstadoObraSocial = z.object({
  id: idObraSocial,
  activa: z.boolean(),
});
