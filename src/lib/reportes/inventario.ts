import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { esFechaValida } from "@/lib/agenda/reglas";
import {
  TIPOS_MOVIMIENTO,
  leerMotivo,
} from "@/lib/vacunacion/inventario-reglas";
import type {
  FiltrosReporteInventario,
  ResultadoReporteInventario,
} from "./tipos";

/*
 * US-SIG-036 — Consultar el inventario actual y su evolución.
 *
 * El reporte es de solo lectura. El stock físico siempre se calcula como la
 * suma firmada de los movimientos (D-19, US-021 CA4): no se guarda un total ni
 * se consultan turnos, compromisos o disponibilidad. Esos datos dependen de
 * US-SIG-023, fuera del alcance del Sprint 3.
 *
 * Recortes aplicados (docs/División USs - SPRINT 3.md):
 * - CA1: se muestran físico, umbral y lotes; no comprometido ni disponible.
 * - CA2: se muestran saldo inicial, entradas, ajustes y saldo final; no la
 *   columna de aplicaciones.
 * - CA4: solo se reconstruye el físico histórico; no se compara con la
 *   situación actual.
 */

const TIPOS_VALIDOS = new Set<string>(TIPOS_MOVIMIENTO);
const MS_DE_UN_DIA = 24 * 60 * 60 * 1000;

/** Inicio del día YYYY-MM-DD en la sala (UTC-3, sin horario de verano). */
function inicioDiaSala(fecha: string): Date {
  return new Date(`${fecha}T00:00:00-03:00`);
}

function esIdValido(valor: string): boolean {
  return /^[1-9]\d*$/.test(valor);
}

function validarFiltros(filtros: FiltrosReporteInventario): void {
  if (!esFechaValida(filtros.desde) || !esFechaValida(filtros.hasta)) {
    throw new Error("El rango de fechas proporcionado no es válido.");
  }

  if (filtros.desde > filtros.hasta) {
    throw new Error(
      "La fecha «Desde» no puede ser posterior a la fecha «Hasta».",
    );
  }

  if (filtros.vacunaId && !esIdValido(filtros.vacunaId)) {
    throw new Error("La vacuna seleccionada no es válida.");
  }

  if (filtros.loteId && !esIdValido(filtros.loteId)) {
    throw new Error("El lote seleccionado no es válido.");
  }

  if (filtros.tipo && !TIPOS_VALIDOS.has(filtros.tipo)) {
    throw new Error("El tipo de movimiento seleccionado no es válido.");
  }
}

type AcumuladoLote = {
  vacunaId: string;
  vacuna: string;
  loteId: string;
  lote: string;
  saldoInicial: number;
  entradas: number;
  ajustes: number;
  aplicaciones: number;
  tieneMovimientos: boolean;
};

/**
 * Consulta las existencias físicas actuales y reconstruye la evolución del
 * stock en el período indicado.
 *
 * El resumen del período se calcula por vacuna y lote. El filtro de tipo de
 * movimiento se aplica únicamente al detalle: si se aplicara al resumen, el
 * saldo final dejaría de cerrar con las columnas visibles.
 */
export async function consultarReporteInventario(
  filtros: FiltrosReporteInventario,
): Promise<ResultadoReporteInventario> {
  validarFiltros(filtros);

  const { desde, hasta, vacunaId, loteId, tipo } = filtros;

  const whereLote: Prisma.LoteVacunaWhereInput = {
    ...(vacunaId ? { vacunaId: BigInt(vacunaId) } : {}),
    ...(loteId ? { id: BigInt(loteId) } : {}),
  };

  const inicioDesde = inicioDiaSala(desde);
  const inicioHastaExclusivo = new Date(
    inicioDiaSala(hasta).getTime() + MS_DE_UN_DIA,
  );

  const [vacunas, lotes, iniciales, movimientosPeriodo] = await Promise.all([
    prisma.vacuna.findMany({
      where: vacunaId ? { id: BigInt(vacunaId) } : {},
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        activa: true,
        umbralMinimo: true,
        lotes: {
          where: loteId ? { id: BigInt(loteId) } : {},
          orderBy: [{ fechaVencimiento: "asc" }, { codigo: "asc" }],
          select: {
            id: true,
            codigo: true,
            fechaVencimiento: true,
            movimientos: { select: { cantidad: true } },
          },
        },
      },
    }),
    prisma.loteVacuna.findMany({
      where: whereLote,
      select: {
        id: true,
        codigo: true,
        vacunaId: true,
        vacuna: { select: { nombre: true } },
      },
    }),
    prisma.movimientoStock.groupBy({
      by: ["loteId"],
      where: {
        lote: whereLote,
        creadoEn: { lt: inicioDesde },
      },
      _sum: { cantidad: true },
    }),
    prisma.movimientoStock.findMany({
      where: {
        lote: whereLote,
        creadoEn: { gte: inicioDesde, lt: inicioHastaExclusivo },
      },
      select: {
        id: true,
        loteId: true,
        tipo: true,
        cantidad: true,
        creadoEn: true,
        motivo: true,
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
      orderBy: [{ creadoEn: "asc" }, { id: "asc" }],
    }),
  ]);

  const stockActual = vacunas
    .map((vacuna) => {
      const lotesStock = vacuna.lotes.map((lote) => {
        const fisico = lote.movimientos.reduce(
          (total, movimiento) => total + movimiento.cantidad,
          0,
        );

        return {
          id: lote.id.toString(),
          codigo: lote.codigo,
          fechaVencimiento: lote.fechaVencimiento.toISOString().slice(0, 10),
          fisico,
        };
      });

      const fisico = lotesStock.reduce((total, lote) => total + lote.fisico, 0);

      return {
        id: vacuna.id.toString(),
        nombre: vacuna.nombre,
        activa: vacuna.activa,
        umbralMinimo: vacuna.umbralMinimo,
        fisico,
        bajoUmbral: fisico <= vacuna.umbralMinimo,
        lotes: lotesStock,
      };
    })
    .filter((vacuna) => !loteId || vacuna.lotes.length > 0);

  const acumulados = new Map<string, AcumuladoLote>();

  for (const lote of lotes) {
    const loteIdTexto = lote.id.toString();
    acumulados.set(loteIdTexto, {
      vacunaId: lote.vacunaId.toString(),
      vacuna: lote.vacuna.nombre,
      loteId: loteIdTexto,
      lote: lote.codigo,
      saldoInicial: 0,
      entradas: 0,
      ajustes: 0,
      aplicaciones: 0,
      tieneMovimientos: false,
    });
  }

  for (const inicial of iniciales) {
    const acumulado = acumulados.get(inicial.loteId.toString());
    if (acumulado) {
      acumulado.saldoInicial = inicial._sum.cantidad ?? 0;
    }
  }

  for (const movimiento of movimientosPeriodo) {
    const acumulado = acumulados.get(movimiento.loteId.toString());
    if (!acumulado) continue;

    acumulado.tieneMovimientos = true;

    switch (movimiento.tipo) {
      case "COMPRA":
        acumulado.entradas += movimiento.cantidad;
        break;
      case "AJUSTE":
        acumulado.ajustes += movimiento.cantidad;
        break;
      default:
        // APLICACION: no se muestra como columna por el recorte de US-025,
        // pero se suma al saldo final para que el stock cierre.
        acumulado.aplicaciones += movimiento.cantidad;
        break;
    }
  }

  const resumen = [...acumulados.values()]
    .filter((fila) => fila.saldoInicial !== 0 || fila.tieneMovimientos)
    .map((fila) => ({
      vacunaId: fila.vacunaId,
      vacuna: fila.vacuna,
      loteId: fila.loteId,
      lote: fila.lote,
      saldoInicial: fila.saldoInicial,
      entradas: fila.entradas,
      ajustes: fila.ajustes,
      saldoFinal:
        fila.saldoInicial +
        fila.entradas +
        fila.ajustes +
        fila.aplicaciones,
    }))
    .sort(
      (a, b) =>
        a.vacuna.localeCompare(b.vacuna, "es") ||
        a.lote.localeCompare(b.lote, "es"),
    );

  const movimientos = movimientosPeriodo
    .filter((movimiento) => !tipo || movimiento.tipo === tipo)
    .sort(
      (a, b) =>
        b.creadoEn.getTime() - a.creadoEn.getTime() ||
        (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
    )
    .map((movimiento) => {
      const { texto } = leerMotivo(movimiento.motivo);

      return {
        id: movimiento.id.toString(),
        fecha: movimiento.creadoEn.toISOString(),
        vacuna: movimiento.lote.vacuna.nombre,
        lote: movimiento.lote.codigo,
        tipo: movimiento.tipo,
        cantidad: movimiento.cantidad,
        motivo: texto,
        operador: movimiento.registrador.persona.nombreCompleto,
      };
    });

  return {
    stockActual,
    resumen,
    movimientos,
    totalMovimientos: movimientos.length,
    periodo: { desde, hasta },
    filtrosAplicados: {
      vacunaId: vacunaId ?? null,
      loteId: loteId ?? null,
      tipo: tipo ?? null,
    },
  };
}
