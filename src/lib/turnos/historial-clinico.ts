import { prisma } from "@/lib/db/prisma";
import { cargarBeneficiarios } from "@/lib/turnos/buscar-horarios";

export interface CorreccionHistorialItem {
  id: string;
  motivo: string;
  texto: string;
  creadaEn: string; // ISO 8601
  autorNombre: string;
}

export interface AdjuntoHistorialItem {
  id: string;
  nombre: string;
  mimeType: string;
  tamanoBytes: number;
  creadoEn: string; // ISO 8601
  urlVisualizacion: string;
}

export interface ConsultaHistorialItem {
  turnoId: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:mm
  medicoNombre: string;
  especialidadNombre: string;
  diagnostico: string;
  sintomas: string | null;
  indicaciones: string | null;
  medicacion: string | null;
  estudios: string | null;
  observaciones: string | null;
  certificado: string | null;
  creadaEn: string; // ISO 8601
  correcciones: CorreccionHistorialItem[];
  adjuntos: AdjuntoHistorialItem[];
}

export interface VacunaAplicadaItem {
  id: string;
  fecha: string; // YYYY-MM-DD
  hora?: string; // HH:mm
  vacunaNombre: string;
  dosisOLote: string;
  responsableNombre: string;
}

export interface FiltrosHistorial {
  beneficiarioId: string;
  desde?: string; // YYYY-MM-DD
  hasta?: string; // YYYY-MM-DD
  especialidadId?: string;
}

export interface EspecialidadFiltroItem {
  id: string;
  nombre: string;
}

export interface BeneficiarioInfo {
  id: string;
  nombre: string;
  tipo: string;
}

/**
 * CA1: Verifica si el usuario autenticado tiene permiso para acceder a la ficha
 * del paciente indicado (sea como titular adulto o como tutor vigente de un menor).
 */
export async function verificarAccesoBeneficiario(
  usuarioId: bigint,
  beneficiarioId: string,
): Promise<BeneficiarioInfo | null> {
  const beneficiarios = await cargarBeneficiarios(usuarioId);
  const encontrado = beneficiarios.find((b) => b.id === beneficiarioId);
  return encontrado ?? null;
}

/**
 * CA2 y CA3: Obtiene las consultas médicas completadas de un paciente representado,
 * ordenadas cronológicamente descendente, con filtros opcionales de período y especialidad.
 * Incluye diagnóstico original, notas clínicas, correcciones y adjuntos visualizables.
 */
export async function obtenerConsultasHistorialPaciente(
  filtros: FiltrosHistorial,
): Promise<ConsultaHistorialItem[]> {
  let pacienteIdBig: bigint;
  try {
    pacienteIdBig = BigInt(filtros.beneficiarioId);
  } catch {
    return [];
  }

  // Filtro base: turnos confirmados y atendidos del paciente con consulta registrada
  const whereDisponibilidad: Record<string, unknown> = {};

  if (filtros.especialidadId) {
    try {
      const espId = BigInt(filtros.especialidadId);
      whereDisponibilidad.profesional = {
        medico: {
          especialidadId: espId,
        },
      };
    } catch {
      // Si el id de especialidad no es válido, se ignora el filtro
    }
  }

  if (filtros.desde || filtros.hasta) {
    whereDisponibilidad.fecha = {
      ...(filtros.desde
        ? { gte: new Date(`${filtros.desde}T00:00:00.000Z`) }
        : {}),
      ...(filtros.hasta
        ? { lte: new Date(`${filtros.hasta}T23:59:59.999Z`) }
        : {}),
    };
  }

  const turnos = await prisma.turno.findMany({
    where: {
      pacienteId: pacienteIdBig,
      estado: "CONFIRMADO",
      resultado: "ATENDIDO",
      consulta: { isNot: null },
      ...(Object.keys(whereDisponibilidad).length > 0
        ? { disponibilidad: whereDisponibilidad }
        : {}),
    },
    orderBy: [{ disponibilidad: { fecha: "desc" } }, { hora: "desc" }],
    include: {
      disponibilidad: {
        include: {
          profesional: {
            include: {
              persona: true,
              medico: {
                include: {
                  especialidad: true,
                },
              },
            },
          },
        },
      },
      consulta: {
        include: {
          correcciones: {
            orderBy: { creadaEn: "asc" },
            include: {
              autor: {
                include: {
                  usuario: {
                    include: { persona: true },
                  },
                },
              },
            },
          },
          adjuntos: {
            orderBy: { creadoEn: "asc" },
          },
        },
      },
    },
  });

  return turnos
    .filter((t) => t.consulta !== null)
    .map((t) => {
      const c = t.consulta!;
      const fechaStr = t.disponibilidad.fecha.toISOString().slice(0, 10);
      const horaStr = t.hora.toISOString().slice(11, 16);
      const medicoNombre = t.disponibilidad.profesional.persona.nombreCompleto;
      const especialidadNombre =
        t.disponibilidad.profesional.medico?.especialidad?.nombre ??
        "Medicina General";

      return {
        turnoId: t.id.toString(),
        fecha: fechaStr,
        hora: horaStr,
        medicoNombre,
        especialidadNombre,
        diagnostico: c.diagnostico,
        sintomas: c.sintomas,
        indicaciones: c.indicaciones,
        medicacion: c.medicacion,
        estudios: c.estudios,
        observaciones: c.observaciones,
        certificado: c.certificado,
        creadaEn: c.creadaEn.toISOString(),
        correcciones: c.correcciones.map((corr) => ({
          id: corr.id.toString(),
          motivo: corr.motivo,
          texto: corr.texto,
          creadaEn: corr.creadaEn.toISOString(),
          autorNombre: corr.autor.usuario.persona.nombreCompleto,
        })),
        adjuntos: c.adjuntos.map((adj) => ({
          id: adj.id.toString(),
          nombre: adj.nombre,
          mimeType: adj.mimeType,
          tamanoBytes: Number(adj.tamanoBytes),
          creadoEn: adj.creadoEn.toISOString(),
          // CA4 / CA5 (US-019 / US-020): Visualización en línea sin descarga clínica
          urlVisualizacion: `/api/paciente/turnos/${t.id.toString()}/adjuntos/${adj.id.toString()}/archivo`,
        })),
      };
    });
}

/**
 * CA4: Obtiene las vacunas aplicadas al paciente.
 * Excluye taxativamente movimientos de compras o ajustes de inventario (tipo = APLICACION).
 */
export async function obtenerVacunasAplicadasPaciente(
  pacienteId: string,
): Promise<VacunaAplicadaItem[]> {
  let pacienteIdBig: bigint;
  try {
    pacienteIdBig = BigInt(pacienteId);
  } catch {
    return [];
  }

  const movimientos = await prisma.movimientoStock.findMany({
    where: {
      tipo: "APLICACION",
      turno: {
        pacienteId: pacienteIdBig,
        tipo: "VACUNACION",
        resultado: "ATENDIDO",
      },
    },
    orderBy: { creadoEn: "desc" },
    include: {
      lote: {
        include: { vacuna: true },
      },
      registrador: {
        include: { persona: true },
      },
      turno: {
        include: { disponibilidad: true },
      },
    },
  });

  return movimientos.map((m) => {
    const fecha = m.turno?.disponibilidad
      ? m.turno.disponibilidad.fecha.toISOString().slice(0, 10)
      : m.creadoEn.toISOString().slice(0, 10);
    const hora = m.turno ? m.turno.hora.toISOString().slice(11, 16) : undefined;

    return {
      id: m.id.toString(),
      fecha,
      hora,
      vacunaNombre: m.lote.vacuna.nombre,
      dosisOLote: m.lote.codigo,
      responsableNombre: m.registrador.persona.nombreCompleto,
    };
  });
}

/**
 * Obtiene las especialidades activas para el filtro desplegable.
 */
export async function obtenerEspecialidadesParaFiltro(): Promise<
  EspecialidadFiltroItem[]
> {
  const especialidades = await prisma.especialidad.findMany({
    orderBy: { nombre: "asc" },
  });

  return especialidades.map((e) => ({
    id: e.id.toString(),
    nombre: e.nombre,
  }));
}
