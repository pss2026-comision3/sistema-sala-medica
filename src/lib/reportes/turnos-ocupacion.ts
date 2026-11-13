import { prisma } from "@/lib/db/prisma";
import { esFechaValida } from "@/lib/agenda/reglas";
import type {
  FilaReporteOcupacion,
  FiltrosReporteOcupacion,
  MetricasOcupacion,
  MetricasReservas,
  ResultadoReporteOcupacion,
} from "./tipos";

interface Contadores {
  cuposPublicados: number;
  cuposBloqueados: number;
  cuposOcupados: number;
  confirmadas: number;
  canceladas: number;
  atendidos: number;
  ausentes: number;
  sinRegistrar: number;
}

function contadoresVacios(): Contadores {
  return {
    cuposPublicados: 0,
    cuposBloqueados: 0,
    cuposOcupados: 0,
    confirmadas: 0,
    canceladas: 0,
    atendidos: 0,
    ausentes: 0,
    sinRegistrar: 0,
  };
}

function minutosDelDia(hora: Date): number {
  return hora.getUTCHours() * 60 + hora.getUTCMinutes();
}

/** CA3/CA4: porcentaje con un decimal, o "No aplica" si no hay cupos utilizables. */
function calcularPorcentaje(ocupados: number, utilizables: number): string {
  return utilizables > 0
    ? `${((ocupados / utilizables) * 100).toFixed(1)}%`
    : "No aplica";
}

function aMetricas(c: Contadores): {
  ocupacion: MetricasOcupacion;
  reservas: MetricasReservas;
} {
  const cuposUtilizables = c.cuposPublicados - c.cuposBloqueados;
  return {
    ocupacion: {
      cuposPublicados: c.cuposPublicados,
      cuposBloqueados: c.cuposBloqueados,
      cuposUtilizables,
      cuposOcupados: c.cuposOcupados,
      porcentajeOcupacion: calcularPorcentaje(c.cuposOcupados, cuposUtilizables),
    },
    reservas: {
      confirmadas: c.confirmadas,
      canceladas: c.canceladas,
      atendidos: c.atendidos,
      ausentes: c.ausentes,
      sinRegistrar: c.sinRegistrar,
    },
  };
}

/** Convierte un id del filtro a BigInt; "todos" o vacío significa sin filtro. */
function aIdOpcional(valor?: string): bigint | undefined {
  if (!valor || valor === "todos") return undefined;
  if (!/^\d+$/.test(valor)) {
    throw new Error("Uno de los filtros seleccionados no es válido.");
  }
  return BigInt(valor);
}

export async function consultarReporteOcupacion(
  filtros: FiltrosReporteOcupacion,
  contextoUsuario: { usuarioId: string; rol: "ADMIN" | "MEDICO" },
): Promise<ResultadoReporteOcupacion> {
  const { desde, hasta } = filtros;
  const estado = filtros.estado ?? "todos";
  const modalidad = filtros.modalidad ?? "todos";

  if (!esFechaValida(desde) || !esFechaValida(hasta)) {
    throw new Error("El rango de fechas proporcionado no es válido.");
  }
  if (desde > hasta) {
    throw new Error("La fecha 'Desde' no puede ser posterior a la fecha 'Hasta'.");
  }
  if (!["todos", "CONFIRMADO", "CANCELADO"].includes(estado)) {
    throw new Error("El estado seleccionado no es válido.");
  }
  if (!["todos", "PARTICULAR", "CON_COBERTURA"].includes(modalidad)) {
    throw new Error("La modalidad seleccionada no es válida.");
  }

  // CA5: el médico solo ve lo suyo, aunque mande otro medicoId desde el cliente.
  const profesionalIdFiltro =
    contextoUsuario.rol === "MEDICO"
      ? BigInt(contextoUsuario.usuarioId)
      : aIdOpcional(filtros.medicoId);
  const especialidadIdFiltro = aIdOpcional(filtros.especialidadId);

  const bloques = await prisma.disponibilidad.findMany({
    where: {
      fecha: {
        gte: new Date(`${desde}T00:00:00Z`),
        lte: new Date(`${hasta}T00:00:00Z`),
      },
      ...(profesionalIdFiltro ? { profesionalId: profesionalIdFiltro } : {}),
      profesional: {
        rol: "MEDICO", // excluye agendas de Enfermería
        ...(especialidadIdFiltro
          ? { medico: { especialidadId: especialidadIdFiltro } }
          : {}),
      },
    },
    select: {
      profesionalId: true,
      fecha: true,
      horaDesde: true,
      horaHasta: true,
      estado: true,
      profesional: {
        select: {
          persona: { select: { nombreCompleto: true } },
          medico: {
            select: {
              duracionTurnoMin: true,
              especialidad: { select: { id: true, nombre: true } },
            },
          },
        },
      },
      turnos: {
        where: {
          tipo: "CONSULTA",
          esSobreturno: false,
          // CA4: las retenciones (RESERVADO) no cuentan como turnos asignados
          estado: { in: ["CONFIRMADO", "CANCELADO"] },
        },
        select: {
          hora: true,
          duracionMin: true,
          estado: true,
          resultado: true,
          modalidad: true,
        },
      },
    },
    orderBy: [{ fecha: "asc" }, { horaDesde: "asc" }],
  });

  const totales = contadoresVacios();
  const porMedico = new Map<
    string,
    { nombre: string; especialidad: string; c: Contadores }
  >();
  const porEspecialidad = new Map<string, { nombre: string; c: Contadores }>();
  // Evita contar dos veces el mismo cupo si hubiera bloques superpuestos.
  const cuposVistos = new Set<string>();

  for (const bloque of bloques) {
    const medico = bloque.profesional.medico;
    if (!medico || medico.duracionTurnoMin <= 0) continue;

    const duracion = medico.duracionTurnoMin;
    const fecha = bloque.fecha.toISOString().slice(0, 10);
    const medicoKey = bloque.profesionalId.toString();
    const especialidadKey = medico.especialidad?.id.toString() ?? "sin";
    const especialidadNombre = medico.especialidad?.nombre ?? "Sin especialidad";

    if (!porMedico.has(medicoKey)) {
      porMedico.set(medicoKey, {
        nombre: bloque.profesional.persona.nombreCompleto,
        especialidad: especialidadNombre,
        c: contadoresVacios(),
      });
    }
    if (!porEspecialidad.has(especialidadKey)) {
      porEspecialidad.set(especialidadKey, {
        nombre: especialidadNombre,
        c: contadoresVacios(),
      });
    }

    // Cada suma va al total, a la fila del médico y a la de su especialidad.
    const destinos = [
      totales,
      porMedico.get(medicoKey)!.c,
      porEspecialidad.get(especialidadKey)!.c,
    ];
    const sumar = (campo: keyof Contadores) => {
      for (const d of destinos) d[campo]++;
    };

    // --- Ocupación de cupos (CA3, CA4) ---
    const confirmados = bloque.turnos
      .filter((t) => t.estado === "CONFIRMADO")
      .map((t) => {
        const inicio = minutosDelDia(t.hora);
        return { desde: inicio, hasta: inicio + t.duracionMin };
      });

    const inicioBloque = minutosDelDia(bloque.horaDesde);
    const finBloque = minutosDelDia(bloque.horaHasta);

    for (let m = inicioBloque; m + duracion <= finBloque; m += duracion) {
      const claveCupo = `${medicoKey}:${fecha}:${m}`;
      if (cuposVistos.has(claveCupo)) continue;
      cuposVistos.add(claveCupo);

      sumar("cuposPublicados");

      if (bloque.estado === "SUSPENDIDA") {
        sumar("cuposBloqueados");
        continue;
      }

      // Un cupo está ocupado si algún turno confirmado se superpone con él.
      // Cancelar y volver a reservar el mismo horario sigue siendo 1 cupo.
      const ocupado = confirmados.some(
        (t) => m < t.hasta && t.desde < m + duracion,
      );
      if (ocupado) sumar("cuposOcupados");
    }

    // --- Conteo de reservas (CA2): acá sí aplican estado y modalidad ---
    for (const turno of bloque.turnos) {
      if (estado !== "todos" && turno.estado !== estado) continue;
      if (modalidad !== "todos" && turno.modalidad !== modalidad) continue;

      if (turno.estado === "CANCELADO") {
        sumar("canceladas");
        continue;
      }

      sumar("confirmadas");
      if (turno.resultado === "ATENDIDO") sumar("atendidos");
      else if (turno.resultado === "AUSENTE") sumar("ausentes");
      else sumar("sinRegistrar");
    }
  }

  const filasMedico: FilaReporteOcupacion[] = [...porMedico.entries()]
    .map(([id, fila]) => ({
      id,
      nombre: fila.nombre,
      especialidad: fila.especialidad,
      ...aMetricas(fila.c),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const filasEspecialidad: FilaReporteOcupacion[] = [...porEspecialidad.entries()]
    .map(([id, fila]) => ({ id, nombre: fila.nombre, ...aMetricas(fila.c) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  return {
    ...aMetricas(totales),
    porMedico: filasMedico,
    porEspecialidad: filasEspecialidad,
    periodo: { desde, hasta },
  };
}