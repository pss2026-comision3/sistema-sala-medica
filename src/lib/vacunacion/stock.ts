import { prisma } from "@/lib/db/prisma";
import type { LoteStock, VacunaStock } from "@/lib/vacunacion/tipos";

type MovimientoCantidad = { cantidad: number };

type LoteConMovimientos = {
  id: bigint;
  codigo: string;
  fechaVencimiento: Date;
  movimientos: MovimientoCantidad[];
};

type VacunaConLotes = {
  id: bigint;
  nombre: string;
  descripcion: string | null;
  umbralMinimo: number;
  activa: boolean;
  lotes: LoteConMovimientos[];
};

const incluirLotesConMovimientos = {
  lotes: {
    orderBy: { codigo: "asc" as const },
    include: { movimientos: { select: { cantidad: true } } },
  },
} as const;

function dosisDeLote(lote: { movimientos: MovimientoCantidad[] }): number {
  return lote.movimientos.reduce(
    (total, movimiento) => total + movimiento.cantidad,
    0,
  );
}

/**
 * Suma las cantidades firmadas de todos los movimientos de los lotes.
 * No filtra por `utilizable`: el stock físico incluye todos los lotes.
 */
export function calcularDosisDisponibles(
  lotes: { movimientos: MovimientoCantidad[] }[],
): number {
  return lotes.reduce((total, lote) => total + dosisDeLote(lote), 0);
}

function serializarLote(lote: LoteConMovimientos): LoteStock {
  return {
    id: lote.id.toString(),
    codigo: lote.codigo,
    fechaVencimiento: lote.fechaVencimiento.toISOString().slice(0, 10),
    dosisDisponibles: dosisDeLote(lote),
  };
}

function serializarVacuna(vacuna: VacunaConLotes): VacunaStock {
  return {
    id: vacuna.id.toString(),
    nombre: vacuna.nombre,
    descripcion: vacuna.descripcion,
    umbralMinimo: vacuna.umbralMinimo,
    activa: vacuna.activa,
    dosisDisponibles: calcularDosisDisponibles(vacuna.lotes),
    lotes: vacuna.lotes.map(serializarLote),
  };
}

export async function obtenerCatalogoConStock(): Promise<VacunaStock[]> {
  const vacunas = await prisma.vacuna.findMany({
    orderBy: { nombre: "asc" },
    include: incluirLotesConMovimientos,
  });

  return vacunas.map(serializarVacuna);
}

export async function obtenerVacunaConStock(
  id: bigint,
): Promise<VacunaStock | null> {
  const vacuna = await prisma.vacuna.findUnique({
    where: { id },
    include: incluirLotesConMovimientos,
  });

  return vacuna ? serializarVacuna(vacuna) : null;
}

export async function obtenerDosisDisponiblesVacuna(
  id: bigint,
): Promise<number> {
  const vacuna = await prisma.vacuna.findUnique({
    where: { id },
    select: {
      lotes: {
        select: { movimientos: { select: { cantidad: true } } },
      },
    },
  });

  if (!vacuna) {
    return 0;
  }

  return calcularDosisDisponibles(vacuna.lotes);
}
