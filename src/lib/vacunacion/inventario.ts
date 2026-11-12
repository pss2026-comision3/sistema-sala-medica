import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ZONA_SALA } from "@/lib/agenda/reglas";
import {
  calcularSaldosPosteriores,
  leerMotivo,
  type TipoMovimientoInventario,
} from "@/lib/vacunacion/inventario-reglas";
 
/*
 * US-SIG-026 — consultas del inventario de vacunas.
 *
 * El stock físico de un lote es la suma firmada de sus movimientos (D-19,
 * US-021 CA4): nunca se escribe un total. Las funciones que participan de la
 * validación reciben el cliente a usar para correr dentro de la transacción.
 */
 
type Db = Prisma.TransactionClient | typeof prisma;
 
// ---------------------------------------------------------------------------
// Saldos y compromisos (CA3)
// ---------------------------------------------------------------------------
 
export async function saldoLote(db: Db, loteId: bigint): Promise<number> {
  const { _sum } = await db.movimientoStock.aggregate({
    where: { loteId },
    _sum: { cantidad: true },
  });
  return _sum.cantidad ?? 0;
}
 
/** Stock físico de la vacuna: todos sus lotes (mismo criterio que `stock.ts`). */
export async function fisicoVacuna(db: Db, vacunaId: bigint): Promise<number> {
  const { _sum } = await db.movimientoStock.aggregate({
    where: { lote: { vacunaId } },
    _sum: { cantidad: true },
  });
  return _sum.cantidad ?? 0;
}
 
/**
 * Dosis comprometidas de una vacuna: citas de vacunación confirmadas sin
 * resultado (aunque ya hayan pasado: el tiempo no libera el compromiso,
 * US-023 CA6) y retenciones temporales todavía vigentes (US-023 CA3).
 * Hasta que exista la reserva de vacunas (US-023) el resultado es 0.
 */
function filtroCompromisos(ahora: Date): Prisma.TurnoWhereInput {
  return {
    tipo: "VACUNACION",
    OR: [
      { estado: "CONFIRMADO", resultado: "SIN_REGISTRAR" },
      { estado: "RESERVADO", retenidoHasta: { gt: ahora } },
    ],
  };
}
 
export async function compromisosVacuna(
  db: Db,
  vacunaId: bigint,
  ahora: Date,
): Promise<number> {
  return db.turno.count({ where: { vacunaId, ...filtroCompromisos(ahora) } });
}
 
// ---------------------------------------------------------------------------
// Datos para el formulario de movimientos
// ---------------------------------------------------------------------------
 
export type LoteFormulario = {
  id: string;
  codigo: string;
  fechaVencimiento: string; // YYYY-MM-DD
  saldo: number;
};
 
export type MovimientoCorregible = {
  id: string;
  loteId: string;
  tipo: "COMPRA" | "AJUSTE";
  cantidad: number;
  creadoEn: string; // ISO
};
 
export type VacunaFormulario = {
  id: string;
  nombre: string;
  fisico: number;
  compromisos: number;
  lotes: LoteFormulario[];
  /** CA5: compras y ajustes que un nuevo ajuste puede compensar. */
  corregibles: MovimientoCorregible[];
};
 
/** Vacunas activas con sus lotes, saldos y compromisos. */
export async function obtenerVacunasParaMovimientos(
  ahora: Date = new Date(),
): Promise<VacunaFormulario[]> {
  const [vacunas, compromisos] = await Promise.all([
    prisma.vacuna.findMany({
      where: { activa: true },
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        lotes: {
          orderBy: [{ fechaVencimiento: "asc" }, { codigo: "asc" }],
          select: {
            id: true,
            codigo: true,
            fechaVencimiento: true,
            movimientos: {
              orderBy: [{ creadoEn: "desc" }, { id: "desc" }],
              select: { id: true, tipo: true, cantidad: true, creadoEn: true },
            },
          },
        },
      },
    }),
    prisma.turno.findMany({
      where: { vacunaId: { not: null }, ...filtroCompromisos(ahora) },
      select: { vacunaId: true },
    }),
  ]);
 
  const compromisosPorVacuna = new Map<string, number>();
  for (const turno of compromisos) {
    const clave = turno.vacunaId!.toString();
    compromisosPorVacuna.set(clave, (compromisosPorVacuna.get(clave) ?? 0) + 1);
  }
 
  return vacunas.map((vacuna) => {
    const lotes = vacuna.lotes.map((lote) => ({
      id: lote.id.toString(),
      codigo: lote.codigo,
      fechaVencimiento: lote.fechaVencimiento.toISOString().slice(0, 10),
      saldo: lote.movimientos.reduce((total, m) => total + m.cantidad, 0),
    }));
    const corregibles: MovimientoCorregible[] = vacuna.lotes.flatMap((lote) =>
      lote.movimientos
        .filter((m) => m.tipo === "COMPRA" || m.tipo === "AJUSTE")
        .map((m) => ({
          id: m.id.toString(),
          loteId: lote.id.toString(),
          tipo: m.tipo as "COMPRA" | "AJUSTE",
          cantidad: m.cantidad,
          creadoEn: m.creadoEn.toISOString(),
        })),
    );
    return {
      id: vacuna.id.toString(),
      nombre: vacuna.nombre,
      fisico: lotes.reduce((total, lote) => total + lote.saldo, 0),
      compromisos: compromisosPorVacuna.get(vacuna.id.toString()) ?? 0,
      lotes,
      corregibles,
    };
  });
}
 
// ---------------------------------------------------------------------------
// CA4: historial de movimientos con saldo posterior y filtros
// ---------------------------------------------------------------------------
 
export type FiltrosMovimientos = {
  vacunaId?: string;
  loteId?: string;
  tipo?: TipoMovimientoInventario;
  desde?: string; // YYYY-MM-DD (fecha de registro, hora de la sala)
  hasta?: string; // YYYY-MM-DD
};
 
export type MovimientoHistorial = {
  id: string;
  creadoEn: string; // ISO
  vacuna: string;
  lote: string;
  tipo: TipoMovimientoInventario;
  cantidad: number;
  saldoLote: number;
  saldoVacuna: number;
  motivo: string | null;
  corrigeId: string | null;
  corregidoPor: string[];
  operador: string;
  turnoId: string | null;
};
 
export const LIMITE_HISTORIAL = 500;
 
/** Inicio del día YYYY-MM-DD en la sala (UTC-3, sin horario de verano). */
function inicioDiaSala(fecha: string): Date {
  return new Date(`${fecha}T00:00:00-03:00`);
}
 
export async function listarMovimientosInventario(
  filtros: FiltrosMovimientos,
): Promise<{ movimientos: MovimientoHistorial[]; total: number }> {
  // Los saldos se calculan sobre todos los movimientos de la vacuna (o de
  // todas), y recién después se aplican los filtros: así el saldo posterior
  // no depende de lo que se esté mirando.
  const filas = await prisma.movimientoStock.findMany({
    where: filtros.vacunaId
      ? { lote: { vacunaId: BigInt(filtros.vacunaId) } }
      : {},
    select: {
      id: true,
      loteId: true,
      turnoId: true,
      tipo: true,
      cantidad: true,
      motivo: true,
      creadoEn: true,
      lote: {
        select: {
          codigo: true,
          vacunaId: true,
          vacuna: { select: { nombre: true } },
        },
      },
      registrador: {
        select: { persona: { select: { nombreCompleto: true } } },
      },
    },
  });
 
  const conSaldo = calcularSaldosPosteriores(
    filas.map((fila) => ({ ...fila, vacunaId: fila.lote.vacunaId })),
  );
 
  // CA5: qué ajustes compensan a cada movimiento.
  const corregidoPor = new Map<string, string[]>();
  for (const fila of conSaldo) {
    const { corrigeId } = leerMotivo(fila.motivo);
    if (!corrigeId) continue;
    const lista = corregidoPor.get(corrigeId) ?? [];
    lista.push(fila.id.toString());
    corregidoPor.set(corrigeId, lista);
  }
 
  const desde = filtros.desde ? inicioDiaSala(filtros.desde) : null;
  const hasta = filtros.hasta
    ? new Date(inicioDiaSala(filtros.hasta).getTime() + 24 * 60 * 60 * 1000)
    : null;
 
  const filtrados = conSaldo
    .filter(
      (fila) =>
        (!filtros.loteId || fila.loteId.toString() === filtros.loteId) &&
        (!filtros.tipo || fila.tipo === filtros.tipo) &&
        (!desde || fila.creadoEn >= desde) &&
        (!hasta || fila.creadoEn < hasta),
    )
    .reverse(); // más recientes primero
 
  return {
    total: filtrados.length,
    movimientos: filtrados.slice(0, LIMITE_HISTORIAL).map((fila) => {
      const { corrigeId, texto } = leerMotivo(fila.motivo);
      return {
        id: fila.id.toString(),
        creadoEn: fila.creadoEn.toISOString(),
        vacuna: fila.lote.vacuna.nombre,
        lote: fila.lote.codigo,
        tipo: fila.tipo,
        cantidad: fila.cantidad,
        saldoLote: fila.saldoLote,
        saldoVacuna: fila.saldoVacuna,
        motivo: texto,
        corrigeId,
        corregidoPor: corregidoPor.get(fila.id.toString()) ?? [],
        operador: fila.registrador.persona.nombreCompleto,
        turnoId: fila.turnoId?.toString() ?? null,
      };
    }),
  };
}
 
/** Opciones de los filtros: todas las vacunas y lotes, también inactivos. */
export async function obtenerOpcionesFiltroInventario() {
  const vacunas = await prisma.vacuna.findMany({
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      lotes: { orderBy: { codigo: "asc" }, select: { id: true, codigo: true } },
    },
  });
  return vacunas.map((vacuna) => ({
    id: vacuna.id.toString(),
    nombre: vacuna.nombre,
    lotes: vacuna.lotes.map((lote) => ({
      id: lote.id.toString(),
      codigo: lote.codigo,
    })),
  }));
}
 
/** Fecha y hora de registro en horario de la sala. */
export function formatearFechaHoraSala(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: ZONA_SALA,
  }).format(new Date(iso));
}