import { z } from "zod";

import { MSG } from "@/lib/auth/constants";

/**
 * Normaliza el nombre de una vacuna al formato canónico del catálogo:
 * sin espacios sobrantes y con la primera letra de cada palabra en mayúscula.
 */
export function normalizarNombreVacuna(valor: string): string {
  return valor
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es")
    .replace(/(^|\s)(\p{L})/gu, (_, separador: string, letra: string) =>
      separador + letra.toLocaleUpperCase("es"),
    );
}

const idVacuna = z.string().regex(/^[1-9]\d*$/, MSG.VACUNA_NO_ENCONTRADA);

const nombreVacuna = z
  .string()
  .trim()
  .min(1, MSG.VACUNA_NOMBRE_REQUERIDO)
  .max(120, MSG.VACUNA_NOMBRE_LARGO)
  .transform(normalizarNombreVacuna);

const descripcionVacuna = z
  .string()
  .trim()
  .max(1000, MSG.VACUNA_DESCRIPCION_LARGA)
  .optional()
  .nullable()
  .transform((valor) => (valor ? valor : null));

const umbralMinimo = z
  .number()
  .int(MSG.VACUNA_UMBRAL_INVALIDO)
  .min(0, MSG.VACUNA_UMBRAL_INVALIDO)
  .max(1_000_000, MSG.VACUNA_UMBRAL_INVALIDO);

export const esquemaCrearVacuna = z.object({
  nombre: nombreVacuna,
  descripcion: descripcionVacuna,
  umbralMinimo,
});

export const esquemaEditarVacuna = z.object({
  id: idVacuna,
  nombre: nombreVacuna,
  descripcion: descripcionVacuna,
  umbralMinimo,
});

export const esquemaEstadoVacuna = z.object({
  id: idVacuna,
  activa: z.boolean(),
});
