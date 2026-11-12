/**
 * US-SIG-026 — Registrar entradas y ajustes de inventario.
 *
 * Textos, constantes y reglas puras (sin Prisma ni Next.js), para que las
 * usen tanto la Server Action como el formulario cliente. Mismo estilo que
 * `lib/agenda/suspension.ts` y `lib/agenda/resolucion.ts`.
 */
 
export const MSG_INVENTARIO = {
  SIN_PERMISO:
    "Tu rol no tiene permiso para registrar movimientos de inventario.",
  TIPO_INVALIDO:
    "Elegí si el movimiento es una entrada por compra o un ajuste.",
  VACUNA_REQUERIDA: "Elegí la vacuna.",
  VACUNA_NO_ENCONTRADA: "La vacuna elegida no existe.",
  VACUNA_INACTIVA:
    "La vacuna está inactiva. Activala desde Vacunas antes de registrar movimientos.",
  LOTE_REQUERIDO: "Elegí un lote existente o cargá los datos de un lote nuevo.",
  LOTE_NO_ENCONTRADO: "El lote elegido no existe o no pertenece a esa vacuna.",
  LOTE_CODIGO_REQUERIDO: "Ingresá el código del lote.",
  LOTE_CODIGO_LARGO: "El código de lote admite hasta 100 caracteres.",
  LOTE_CODIGO_DUPLICADO:
    "Ya existe un lote con ese código. Elegilo en «Lote existente».",
  LOTE_VENCIMIENTO_INVALIDO: "Ingresá una fecha de vencimiento válida.",
  LOTE_VENCIMIENTO_PASADO:
    "El vencimiento del lote nuevo tiene que ser posterior a hoy.",
  LOTE_NUEVO_SOLO_POSITIVO:
    "Un lote nuevo empieza sin dosis: el ajuste tiene que ser positivo.",
  CANTIDAD_ENTERA: "La cantidad tiene que ser un número entero.",
  CANTIDAD_COMPRA:
    "La cantidad de una compra tiene que ser un entero mayor a 0.",
  CANTIDAD_AJUSTE:
    "La variación del ajuste tiene que ser un entero distinto de 0.",
  CANTIDAD_MAXIMA:
    "La cantidad no puede superar las 100.000 dosis por movimiento.",
  REFERENCIA_REQUERIDA:
    "Ingresá la referencia de la compra (remito, factura u orden de compra).",
  MOTIVO_REQUERIDO: "Ingresá el motivo del ajuste.",
  TEXTO_LARGO: "El texto admite hasta 500 caracteres.",
  CORRECCION_NO_ENCONTRADA:
    "El movimiento a corregir no existe o no pertenece al lote elegido.",
  CORRECCION_APLICACION:
    "Las bajas por aplicación no se corrigen con ajustes: se generan al registrar la vacuna aplicada.",
  CORRECCION_SOLO_AJUSTE: "Solo un ajuste puede corregir otro movimiento.",
  ERROR_INTERNO: "Ocurrió un error interno al registrar el movimiento.",
  FILTRO_PERIODO: "La fecha «desde» tiene que ser anterior o igual a «hasta».",
} as const;
 
export const TIPOS_MOVIMIENTO = ["COMPRA", "APLICACION", "AJUSTE"] as const;
export type TipoMovimientoInventario = (typeof TIPOS_MOVIMIENTO)[number];
 
/** Tipos que se cargan a mano (CA4: la baja por aplicación la genera US-025). */
export const TIPOS_MANUALES = ["COMPRA", "AJUSTE"] as const;
export type TipoMovimientoManual = (typeof TIPOS_MANUALES)[number];
 
export const ETIQUETA_TIPO_MOVIMIENTO: Record<
  TipoMovimientoInventario,
  string
> = {
  COMPRA: "Entrada por compra",
  APLICACION: "Baja por aplicación",
  AJUSTE: "Ajuste",
};
 
export const CANTIDAD_MAXIMA = 100_000;
export const TEXTO_MAX = 500;
export const CODIGO_LOTE_MAX = 100;
 
/** Motivo sugerido para la carga inicial de un lote (CA1). */
export const MOTIVO_CARGA_INICIAL = "Carga inicial";
 
// ---------------------------------------------------------------------------
// CA5: la corrección se identifica dentro de `movimiento_stock.motivo`.
// El modelo no tiene una columna para el movimiento corregido y agregarla
// exige una migración (ver D-24); el prefijo es fijo y se valida al escribir.
// ---------------------------------------------------------------------------
 
const PATRON_CORRECCION = /^Corrige movimiento #(\d+)\. ([\s\S]*)$/;
 
export function componerMotivoCorreccion(
  movimientoCorregidoId: string,
  motivo: string,
): string {
  return `Corrige movimiento #${movimientoCorregidoId}. ${motivo}`;
}
 
/** Separa la referencia al movimiento corregido del motivo escrito por el operador. */
export function leerMotivo(motivo: string | null): {
  corrigeId: string | null;
  texto: string | null;
} {
  if (!motivo) return { corrigeId: null, texto: null };
  const coincide = PATRON_CORRECCION.exec(motivo);
  if (!coincide) return { corrigeId: null, texto: motivo };
  return { corrigeId: coincide[1], texto: coincide[2] };
}
 
// ---------------------------------------------------------------------------
// CA3: un lote no queda negativo y el físico de la vacuna no queda por
// debajo de sus compromisos (dosis reservadas todavía no aplicadas).
// ---------------------------------------------------------------------------
 
export type EvaluacionStock =
  | { ok: true; saldoLote: number; fisicoVacuna: number }
  | { ok: false; error: string };
 
export function evaluarMovimientoStock(input: {
  codigoLote: string;
  saldoLote: number;
  fisicoVacuna: number;
  compromisos: number;
  cantidad: number;
}): EvaluacionStock {
  const saldoLote = input.saldoLote + input.cantidad;
  const fisicoVacuna = input.fisicoVacuna + input.cantidad;
 
  if (saldoLote < 0) {
    return {
      ok: false,
      error:
        `El lote ${input.codigoLote} tiene ${input.saldoLote} dosis: ` +
        `no se le pueden descontar ${Math.abs(input.cantidad)}.`,
    };
  }
 
  if (fisicoVacuna < input.compromisos) {
    const aResolver = input.compromisos - fisicoVacuna;
    return {
      ok: false,
      error:
        `No alcanza el stock: la vacuna quedaría con ${fisicoVacuna} dosis ` +
        `físicas y tiene ${input.compromisos} comprometidas por reservas. ` +
        `Antes de este ajuste hay que resolver ${aResolver} ` +
        `${aResolver === 1 ? "reserva" : "reservas"} (aplicación, ausencia o cancelación).`,
    };
  }
 
  return { ok: true, saldoLote, fisicoVacuna };
}
 
// ---------------------------------------------------------------------------
// CA4: saldo posterior de cada movimiento, por lote y por vacuna. Se ordena
// por fecha de registro (y id para desempatar), así un saldo pasado nunca
// cambia por movimientos posteriores.
// ---------------------------------------------------------------------------
 
export type MovimientoParaSaldo = {
  id: bigint;
  loteId: bigint;
  vacunaId: bigint;
  cantidad: number;
  creadoEn: Date;
};
 
export function calcularSaldosPosteriores<T extends MovimientoParaSaldo>(
  movimientos: T[],
): (T & { saldoLote: number; saldoVacuna: number })[] {
  const ordenados = [...movimientos].sort(
    (a, b) =>
      a.creadoEn.getTime() - b.creadoEn.getTime() ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const porLote = new Map<string, number>();
  const porVacuna = new Map<string, number>();
 
  return ordenados.map((movimiento) => {
    const claveLote = movimiento.loteId.toString();
    const claveVacuna = movimiento.vacunaId.toString();
    const saldoLote = (porLote.get(claveLote) ?? 0) + movimiento.cantidad;
    const saldoVacuna = (porVacuna.get(claveVacuna) ?? 0) + movimiento.cantidad;
    porLote.set(claveLote, saldoLote);
    porVacuna.set(claveVacuna, saldoVacuna);
    return { ...movimiento, saldoLote, saldoVacuna };
  });
}
 
/** "+20" / "-3": la cantidad firmada tal como afecta al stock. */
export function cantidadConSigno(cantidad: number): string {
  return cantidad > 0 ? `+${cantidad}` : String(cantidad);
}