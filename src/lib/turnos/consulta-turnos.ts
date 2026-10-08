import { prisma } from "@/lib/db/prisma";
import { inicioTurno, puedeCancelarTurno } from "@/lib/agenda/reglas";
import { ETIQUETA_ESTADO_CITA } from "@/lib/agenda/etiquetas";

export type FiltrosTurnos = {
  beneficiario: string;
  periodo: "proximos" | "pasados" | "todos";
  estado: "confirmado" | "cancelado" | "todos";
  resultado: "sin_registrar" | "atendido" | "ausente" | "todos";
  especialidad?: string;
  vacuna?: string;
};

export type FiltrosTurnosURL = Omit<FiltrosTurnos, "beneficiario">;

export type SituacionCobro = "COBRADA" | "SIN_COBRAR" | "SIN_COBRO_PACIENTE";

export type TurnoLista = {
  id: string;
  fecha: string;
  hora: string;
  inicio: string;
  tipo: "CONSULTA" | "VACUNACION";
  prestacion: string;
  profesional: string;
  especialidadId: string | null;
  vacunaId: string | null;
  estado: "RESERVADO" | "CONFIRMADO" | "CANCELADO";
  estadoEtiqueta: string;
  resultado: "SIN_REGISTRAR" | "ATENDIDO" | "AUSENTE";
  resultadoEtiqueta: string;
  resultadoVisible: boolean;
  pendienteDeResolver: boolean;
  motivoSuspension: string | null;
  reprogramada: boolean;
  reprogramadoDesdeId: string | null;
  situacionCobro: SituacionCobro;
  facturaDisponible: boolean;
  cancelable: boolean;
  cancelableMotivo: string;
};

const ESTADO_POR_DEFECTO = "todos";
const RESULTADO_POR_DEFECTO = "todos";

const unico = (valor: string | string[] | undefined) =>
  Array.isArray(valor) ? valor[0] : valor;

export function leerFiltrosTurnos(
  params: Record<string, string | string[] | undefined>,
): FiltrosTurnosURL {
  const periodo = unico(params.periodo);
  const estado = unico(params.estado);
  const resultado = unico(params.resultado);
  const especialidad = unico(params.especialidad);
  const vacuna = unico(params.vacuna);

  return {
    periodo:
      periodo === "pasados" || periodo === "todos" ? periodo : "proximos",
    estado:
      estado === "confirmado" || estado === "cancelado"
        ? estado
        : ESTADO_POR_DEFECTO,
    resultado:
      resultado === "atendido" || resultado === "ausente"
        ? resultado
        : resultado === "sin_registrar"
          ? "sin_registrar"
          : RESULTADO_POR_DEFECTO,
    especialidad: especialidad || undefined,
    vacuna: vacuna || undefined,
  };
}

/** Serializa una fila `turno` de Prisma al tipo plano de presentación. */
function serializarTurno(
  turno: {
    id: bigint;
    tipo: "CONSULTA" | "VACUNACION";
    hora: Date;
    estado: "RESERVADO" | "CONFIRMADO" | "CANCELADO";
    resultado: "SIN_REGISTRAR" | "ATENDIDO" | "AUSENTE";
    modalidad: "PARTICULAR" | "CON_COBERTURA";
    reprogramadoDesdeId: bigint | null;
    disponibilidad: {
      fecha: Date;
      estado: "PUBLICADA" | "SUSPENDIDA";
      motivoSuspension: string | null;
      profesional: {
        persona: { nombreCompleto: string };
        medico: { especialidad: { nombre: string } | null } | null;
      };
    };
    vacuna: { nombre: string } | null;
    pagos: { estado: string }[];
    comprobantes: { archivoPrivado: string | null }[];
    reprogramaciones: { id: bigint }[];
  },
  ahora: Date,
): TurnoLista {
  const fecha = turno.disponibilidad.fecha.toISOString().slice(0, 10);
  const hora = turno.hora.toISOString().slice(11, 16);
  const inicio = inicioTurno(fecha, hora);
  const especialidad = turno.disponibilidad.profesional.medico?.especialidad;
  const pendienteDeResolver =
    turno.estado === "CONFIRMADO" &&
    turno.disponibilidad.estado === "SUSPENDIDA";
  const cancel = puedeCancelarTurno({ estado: turno.estado, inicio }, ahora);

  const situacionCobro: SituacionCobro =
    turno.modalidad === "CON_COBERTURA"
      ? "SIN_COBRO_PACIENTE"
      : turno.pagos.some((pago) => pago.estado === "APROBADO")
        ? "COBRADA"
        : "SIN_COBRAR";

  const comprobante = turno.comprobantes[0];

  return {
    id: turno.id.toString(),
    fecha,
    hora,
    inicio,
    tipo: turno.tipo,
    prestacion:
      turno.tipo === "VACUNACION"
        ? (turno.vacuna?.nombre ?? "Vacunación")
        : (especialidad?.nombre ?? "Consulta médica"),
    profesional: turno.disponibilidad.profesional.persona.nombreCompleto,
    estado: turno.estado,
    estadoEtiqueta: ETIQUETA_ESTADO_CITA[turno.estado],
    resultado: turno.resultado,
    resultadoEtiqueta:
      turno.resultado === "SIN_REGISTRAR"
        ? "Sin resultado"
        : turno.resultado === "ATENDIDO"
          ? "Atendido"
          : "Ausente",
    resultadoVisible: turno.resultado !== "SIN_REGISTRAR",
    pendienteDeResolver,
    motivoSuspension: pendienteDeResolver
      ? turno.disponibilidad.motivoSuspension
      : null,
    reprogramada: turno.reprogramaciones.length > 0,
    reprogramadoDesdeId: turno.reprogramadoDesdeId?.toString() ?? null,
    situacionCobro,
    facturaDisponible: !!comprobante?.archivoPrivado,
    cancelable: cancel.puede,
    cancelableMotivo: cancel.motivo,
    especialidadId: especialidad
      ? String((especialidad as { id?: bigint }).id ?? "")
      : null,
    vacunaId: turno.vacuna
      ? String((turno.vacuna as { id: bigint; nombre: string }).id)
      : null,
  };
}

const INCLUDE_TURNO = {
  disponibilidad: {
    select: {
      fecha: true,
      estado: true,
      motivoSuspension: true,
      profesional: {
        select: {
          persona: { select: { nombreCompleto: true } },
          medico: {
            select: {
              especialidad: { select: { nombre: true, id: true } },
            },
          },
        },
      },
    },
  },
  vacuna: { select: { nombre: true, id: true } },
  pagos: { select: { estado: true } },
  comprobantes: { select: { archivoPrivado: true } },
  reprogramaciones: { select: { id: true } },
  reprogramadoDesde: { select: { id: true } },
} as const;

export async function obtenerTurnosPaciente(
  filtros: FiltrosTurnos,
  ahora: Date = new Date(),
): Promise<{
  proximos: TurnoLista[];
  antecedentes: TurnoLista[];
  especialidades: { id: string; nombre: string }[];
  vacunas: { id: string; nombre: string }[];
}> {
  const filas = await prisma.turno.findMany({
    where: { pacienteId: BigInt(filtros.beneficiario) },
    include: INCLUDE_TURNO,
    orderBy: [{ id: "asc" }],
  });

  const todos = filas.map((fila) => serializarTurno(fila, ahora));

  // CA1: filtros por período, estado, resultado, especialidad o vacuna.
  const filtrados = todos.filter((turno) => {
    if (
      filtros.estado !== "todos" &&
      turno.estado !== filtros.estado.toUpperCase()
    ) {
      return false;
    }
    if (
      filtros.resultado !== "todos" &&
      turno.resultado !== filtros.resultado.toUpperCase()
    ) {
      return false;
    }
    if (filtros.especialidad && turno.tipo === "CONSULTA") {
      if (turno.especialidadId !== filtros.especialidad) return false;
    } else if (filtros.especialidad && turno.tipo !== "CONSULTA") {
      return false;
    }
    if (filtros.vacuna && turno.tipo === "VACUNACION") {
      if (turno.vacunaId !== filtros.vacuna) return false;
    } else if (filtros.vacuna && turno.tipo !== "VACUNACION") {
      return false;
    }
    return true;
  });

  const porInicioAsc = [...filtrados].sort((a, b) =>
    a.inicio.localeCompare(b.inicio),
  );
  const porInicioDesc = [...filtrados].sort((a, b) =>
    b.inicio.localeCompare(a.inicio),
  );

  const ahoraIso = ahora.toISOString();
  let proximos = porInicioAsc.filter((t) => t.inicio >= ahoraIso);
  let antecedentes = porInicioDesc.filter((t) => t.inicio < ahoraIso);

  if (filtros.periodo === "proximos") antecedentes = [];
  if (filtros.periodo === "pasados") proximos = [];

  const especialidades = new Map<string, string>();
  const vacunas = new Map<string, string>();
  for (const fila of filas) {
    const esp = fila.disponibilidad.profesional.medico?.especialidad;
    if (esp) especialidades.set(esp.id.toString(), esp.nombre);
    if (fila.vacuna) vacunas.set(fila.vacuna.id.toString(), fila.vacuna.nombre);
  }

  return {
    proximos,
    antecedentes,
    especialidades: [...especialidades.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    vacunas: [...vacunas.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
  };
}

/** Carga la ficha de una cita verificando que pertenezca al beneficiario. */
export async function obtenerCitaPaciente(
  turnoId: string,
  beneficiarioId: string,
  ahora: Date = new Date(),
): Promise<TurnoLista | null> {
  let id: bigint;
  try {
    id = BigInt(turnoId);
  } catch {
    return null;
  }

  const turno = await prisma.turno.findUnique({
    where: { id },
    include: INCLUDE_TURNO,
  });
  if (!turno || turno.pacienteId.toString() !== beneficiarioId) return null;

  return serializarTurno(turno, ahora);
}
