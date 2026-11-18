/**
 * US-SIG-037 — Consultar cobros y prestaciones con cobertura.
 *
 * Alcance acotado por el recorte del Sprint 3 (ver docs/PLAN-US-037.md):
 * al no existir US-029 (cobro simulado) ni US-030 (factura), este servicio
 * solo arma la SECCIÓN DE PRESTACIONES (CA3 y CA4). No hay sección de cobros,
 * ni ingresos simulados, ni estado "cobrada / sin cobrar".
 *
 * Reglas:
 * - CA3: se toman las citas ATENDIDAS cuya fecha de cita (disponibilidad.fecha)
 *   cae dentro del período, y se clasifican en Particular, Gratuita o
 *   Con cobertura registrada.
 * - CA4: filtros por entidad de cobertura, médico y especialidad. Una cobertura
 *   registrada NO es un pago recibido: por eso el reporte no suma importes como
 *   ingresos; el arancel se muestra solo como valor de referencia.
 * - Cambio de alcance: solo turnos médicos (consultas), igual que US-034/035.
 *   Al quedar fuera US-022/023/024/025 no existen turnos de vacunación.
 */

import { prisma } from "@/lib/db/prisma";
import { esFechaValida } from "@/lib/agenda/reglas";
import type {
  CategoriaPrestacion,
  ConteoCategoriasPrestacion,
  FilaEntidadCobertura,
  FilaMedicoPrestaciones,
  FiltrosReporteCobertura,
  OpcionObraSocial,
  PrestacionReporte,
  ResultadoReporteCobertura,
} from "./tipos";

const CATEGORIAS_VALIDAS: readonly CategoriaPrestacion[] = [
  "PARTICULAR",
  "GRATUITA",
  "CON_COBERTURA",
];

function conteoVacio(): ConteoCategoriasPrestacion {
  return { total: 0, particular: 0, gratuita: 0, conCobertura: 0 };
}

function sumarAlConteo(
  conteo: ConteoCategoriasPrestacion,
  categoria: CategoriaPrestacion,
) {
  conteo.total++;
  if (categoria === "PARTICULAR") conteo.particular++;
  else if (categoria === "GRATUITA") conteo.gratuita++;
  else conteo.conCobertura++;
}

/** Convierte un id del filtro a BigInt; "todos"/"todas" o vacío = sin filtro. */
function aIdOpcional(valor?: string): bigint | undefined {
  if (!valor || valor === "todos" || valor === "todas") return undefined;
  if (!/^\d+$/.test(valor)) {
    throw new Error("Uno de los filtros seleccionados no es válido.");
  }
  return BigInt(valor);
}

/**
 * CA3: clasifica una prestación atendida.
 * - Arancel $0 → Gratuita (el arancel del médico admite $0), sin importar la modalidad.
 * - Modalidad CON_COBERTURA → Con cobertura registrada.
 * - Resto → Particular (sin estado de cobro, porque US-029 quedó fuera).
 */
export function clasificarPrestacion(
  modalidad: "PARTICULAR" | "CON_COBERTURA",
  arancel: number,
): CategoriaPrestacion {
  if (arancel <= 0) return "GRATUITA";
  if (modalidad === "CON_COBERTURA") return "CON_COBERTURA";
  return "PARTICULAR";
}

function aHora(hora: Date): string {
  const hh = String(hora.getUTCHours()).padStart(2, "0");
  const mm = String(hora.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export async function consultarReporteCobertura(
  filtros: FiltrosReporteCobertura,
): Promise<ResultadoReporteCobertura> {
  const { desde, hasta } = filtros;
  const categoria = filtros.categoria ?? "todas";

  if (!esFechaValida(desde) || !esFechaValida(hasta)) {
    throw new Error("El rango de fechas proporcionado no es válido.");
  }
  if (desde > hasta) {
    throw new Error("La fecha 'Desde' no puede ser posterior a la fecha 'Hasta'.");
  }
  if (categoria !== "todas" && !CATEGORIAS_VALIDAS.includes(categoria)) {
    throw new Error("La categoría seleccionada no es válida.");
  }

  const medicoIdFiltro = aIdOpcional(filtros.medicoId);
  const especialidadIdFiltro = aIdOpcional(filtros.especialidadId);
  const obraSocialIdFiltro = aIdOpcional(filtros.obraSocialId);

  const turnos = await prisma.turno.findMany({
    where: {
      // Cambio de alcance: solo turnos médicos (consultas)
      tipo: "CONSULTA",
      // CA3: solo prestaciones atendidas de citas definitivas
      estado: "CONFIRMADO",
      resultado: "ATENDIDO",
      // CA4: filtrar por entidad implica mirar solo turnos con esa cobertura
      ...(obraSocialIdFiltro
        ? { modalidad: "CON_COBERTURA", obraSocialId: obraSocialIdFiltro }
        : {}),
      disponibilidad: {
        // CA3: la fecha de la sección es la fecha de la cita
        fecha: {
          gte: new Date(`${desde}T00:00:00Z`),
          lte: new Date(`${hasta}T00:00:00Z`),
        },
        ...(medicoIdFiltro ? { profesionalId: medicoIdFiltro } : {}),
        ...(especialidadIdFiltro
          ? { profesional: { medico: { especialidadId: especialidadIdFiltro } } }
          : {}),
      },
    },
    select: {
      id: true,
      hora: true,
      arancel: true,
      modalidad: true,
      obraSocialId: true,
      coberturaNombreSnapshot: true,
      coberturaPlanSnapshot: true,
      obraSocial: { select: { nombre: true } },
      paciente: {
        select: { dni: true, persona: { select: { nombreCompleto: true } } },
      },
      disponibilidad: {
        select: {
          fecha: true,
          profesionalId: true,
          profesional: {
            select: {
              persona: { select: { nombreCompleto: true } },
              medico: {
                select: { especialidad: { select: { nombre: true } } },
              },
            },
          },
        },
      },
    },
    orderBy: [{ disponibilidad: { fecha: "desc" } }, { hora: "desc" }],
  });

  const totales = conteoVacio();
  const porMedico = new Map<string, FilaMedicoPrestaciones>();
  const porEntidad = new Map<string, FilaEntidadCobertura>();
  const prestaciones: PrestacionReporte[] = [];

  for (const t of turnos) {
    const arancel = Number(t.arancel);
    const cat = clasificarPrestacion(t.modalidad, arancel);

    // El filtro de categoría se aplica después de clasificar (depende del arancel).
    if (categoria !== "todas" && cat !== categoria) continue;

    const profesional = t.disponibilidad.profesional;
    const especialidad =
      profesional.medico?.especialidad?.nombre ?? "Sin especialidad";
    const entidad =
      t.modalidad === "CON_COBERTURA"
        ? (t.coberturaNombreSnapshot ?? t.obraSocial?.nombre ?? "Sin datos")
        : null;

    sumarAlConteo(totales, cat);

    // Por médico / profesional
    const medicoKey = t.disponibilidad.profesionalId.toString();
    if (!porMedico.has(medicoKey)) {
      porMedico.set(medicoKey, {
        id: medicoKey,
        nombre: profesional.persona.nombreCompleto,
        especialidad,
        conteo: conteoVacio(),
      });
    }
    sumarAlConteo(porMedico.get(medicoKey)!.conteo, cat);

    // Por entidad de cobertura (solo prestaciones con cobertura registrada)
    if (cat === "CON_COBERTURA" && entidad) {
      const entidadKey = t.obraSocialId?.toString() ?? `snap:${entidad}`;
      if (!porEntidad.has(entidadKey)) {
        porEntidad.set(entidadKey, { id: entidadKey, nombre: entidad, prestaciones: 0 });
      }
      porEntidad.get(entidadKey)!.prestaciones++;
    }

    prestaciones.push({
      id: t.id.toString(),
      fecha: t.disponibilidad.fecha.toISOString().slice(0, 10),
      hora: aHora(t.hora),
      paciente: t.paciente.persona.nombreCompleto,
      dni: t.paciente.dni,
      profesional: profesional.persona.nombreCompleto,
      especialidad,
      prestacion: "Consulta médica",
      categoria: cat,
      cobertura: entidad,
      plan: t.modalidad === "CON_COBERTURA" ? t.coberturaPlanSnapshot : null,
      arancelReferencia: arancel,
    });
  }

  return {
    totales,
    porMedico: [...porMedico.values()].sort((a, b) =>
      a.nombre.localeCompare(b.nombre),
    ),
    porEntidad: [...porEntidad.values()].sort(
      (a, b) => b.prestaciones - a.prestaciones || a.nombre.localeCompare(b.nombre),
    ),
    prestaciones,
    periodo: { desde, hasta },
  };
}

/**
 * Catálogo de obras sociales para el filtro "Entidad de cobertura" (CA4).
 * Incluye las inactivas: pudieron tener prestaciones en el período.
 */
export async function obtenerObrasSocialesParaFiltro(): Promise<OpcionObraSocial[]> {
  const obras = await prisma.obraSocial.findMany({
    select: { id: true, nombre: true, activa: true },
    orderBy: { nombre: "asc" },
  });
  return obras.map((o) => ({
    id: o.id.toString(),
    nombre: o.nombre,
    activa: o.activa,
  }));
}
