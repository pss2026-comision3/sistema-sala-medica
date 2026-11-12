import { z } from "zod";
 
import {
  CANTIDAD_MAXIMA,
  CODIGO_LOTE_MAX,
  MSG_INVENTARIO,
  TEXTO_MAX,
} from "@/lib/vacunacion/inventario-reglas";
 
/*
 * US-SIG-026 — validación del movimiento manual de inventario (CA1, CA2).
 * Las reglas que dependen del stock (CA3) se evalúan en la transacción.
 */
 
const id = (mensaje: string) => z.string().regex(/^[1-9]\d*$/, mensaje);
 
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
 
const loteExistente = z.object({
  modo: z.literal("existente"),
  loteId: id(MSG_INVENTARIO.LOTE_REQUERIDO),
});
 
const loteNuevo = z.object({
  modo: z.literal("nuevo"),
  codigo: z
    .string()
    .trim()
    .min(1, MSG_INVENTARIO.LOTE_CODIGO_REQUERIDO)
    .max(CODIGO_LOTE_MAX, MSG_INVENTARIO.LOTE_CODIGO_LARGO),
  fechaVencimiento: z
    .string()
    .regex(FECHA, MSG_INVENTARIO.LOTE_VENCIMIENTO_INVALIDO),
});
 
export const esquemaMovimientoInventario = z
  .object({
    tipo: z.enum(["COMPRA", "AJUSTE"], { error: MSG_INVENTARIO.TIPO_INVALIDO }),
    vacunaId: id(MSG_INVENTARIO.VACUNA_REQUERIDA),
    lote: z.discriminatedUnion("modo", [loteExistente, loteNuevo], {
      error: MSG_INVENTARIO.LOTE_REQUERIDO,
    }),
    cantidad: z
      .number({ error: MSG_INVENTARIO.CANTIDAD_ENTERA })
      .int(MSG_INVENTARIO.CANTIDAD_ENTERA)
      .min(-CANTIDAD_MAXIMA, MSG_INVENTARIO.CANTIDAD_MAXIMA)
      .max(CANTIDAD_MAXIMA, MSG_INVENTARIO.CANTIDAD_MAXIMA),
    /** Compra: referencia. Ajuste: motivo. Siempre obligatorio. */
    texto: z.string().trim().max(TEXTO_MAX, MSG_INVENTARIO.TEXTO_LARGO),
    /** Solo ajustes (CA5): movimiento que este ajuste compensa. */
    corrigeMovimientoId: id(MSG_INVENTARIO.CORRECCION_NO_ENCONTRADA)
      .optional()
      .nullable(),
  })
  .superRefine((datos, ctx) => {
    if (datos.tipo === "COMPRA") {
      if (datos.cantidad <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["cantidad"],
          message: MSG_INVENTARIO.CANTIDAD_COMPRA,
        });
      }
      if (!datos.texto) {
        ctx.addIssue({
          code: "custom",
          path: ["texto"],
          message: MSG_INVENTARIO.REFERENCIA_REQUERIDA,
        });
      }
      if (datos.corrigeMovimientoId) {
        ctx.addIssue({
          code: "custom",
          path: ["corrigeMovimientoId"],
          message: MSG_INVENTARIO.CORRECCION_SOLO_AJUSTE,
        });
      }
    } else {
      if (datos.cantidad === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["cantidad"],
          message: MSG_INVENTARIO.CANTIDAD_AJUSTE,
        });
      }
      if (!datos.texto) {
        ctx.addIssue({
          code: "custom",
          path: ["texto"],
          message: MSG_INVENTARIO.MOTIVO_REQUERIDO,
        });
      }
    }
 
    if (datos.lote.modo === "nuevo" && datos.cantidad <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["cantidad"],
        message: MSG_INVENTARIO.LOTE_NUEVO_SOLO_POSITIVO,
      });
    }
    if (datos.lote.modo === "nuevo" && datos.corrigeMovimientoId) {
      ctx.addIssue({
        code: "custom",
        path: ["corrigeMovimientoId"],
        message: MSG_INVENTARIO.CORRECCION_NO_ENCONTRADA,
      });
    }
  });
 
export type MovimientoInventarioInput = z.infer<
  typeof esquemaMovimientoInventario
>;