import type {
  FiltrosReporteAsistencia,
  FiltrosReporteCobertura,
  FiltrosReporteInventario,
  FiltrosReporteOcupacion,
  ResultadoReporteAsistencia,
  ResultadoReporteCobertura,
  ResultadoReporteInventario,
  ResultadoReporteOcupacion,
} from "../tipos";

export type Celda = string | number;
export interface TablaExportada {
  titulo: string;
  columnas: string[];
  filas: Celda[][];
}
export interface DocumentoExportado {
  titulo: string;
  periodo: { desde: string; hasta: string };
  generadoEn: string;
  filtros: [string, string][];
  totales: [string, Celda][];
  tablas: TablaExportada[];
  notas?: string[];
}

const valorFiltro = (valor?: string, general = "Todos") =>
  !valor || valor === "todos" || valor === "todas" ? general : valor;

function base(
  titulo: string,
  periodo: { desde: string; hasta: string },
  ahora: Date,
  filtros: [string, string][],
): Omit<DocumentoExportado, "totales" | "tablas"> {
  return { titulo, periodo, generadoEn: ahora.toISOString(), filtros };
}

export function proyectarAsistencia(
  r: ResultadoReporteAsistencia,
  f: FiltrosReporteAsistencia,
  ahora: Date,
): DocumentoExportado {
  return {
    ...base("Asistencia, ausencias y recordatorios", r.periodo, ahora, [
      ["Médico", valorFiltro(f.medicoId)],
      ["Especialidad", valorFiltro(f.especialidadId)],
    ]),
    totales: [
      ["Atendidos", r.asistencia.atendidos],
      ["Ausentes", r.asistencia.ausentes],
      ["Sin registrar", r.asistencia.sinRegistrar],
      ["Cancelados", r.asistencia.cancelados],
      ["Futuros excluidos", r.asistencia.futurosExcluidos],
      ["Porcentaje de asistencia", r.asistencia.porcentajeAsistencia],
      ["Recordatorios enviados", r.recordatorios.enviados],
      ["Recordatorios fallidos", r.recordatorios.fallidos],
      ["Reserva tardía", r.recordatorios.reservaTardia],
      ["Sin recordatorio", r.recordatorios.sinRecordatorio],
      ["Citas del período", r.citas.length],
    ],
    tablas: [
      {
        titulo: "Detalle de citas",
        columnas: [
          "Fecha",
          "Hora",
          "Paciente",
          "Médico",
          "Especialidad",
          "Estado",
          "Resultado",
          "Recordatorio",
        ],
        filas: r.citas.map((c) => [
          c.fecha,
          c.hora,
          c.paciente,
          c.medico,
          c.especialidad,
          c.estado,
          c.resultado,
          c.estadoRecordatorio,
        ]),
      },
    ],
  };
}

export function proyectarOcupacion(
  r: ResultadoReporteOcupacion,
  f: FiltrosReporteOcupacion,
  ahora: Date,
): DocumentoExportado {
  const columnas = [
    "Nombre",
    "Especialidad",
    "Cupos publicados",
    "Cupos bloqueados",
    "Cupos utilizables",
    "Cupos ocupados",
    "Ocupación",
    "Reservas confirmadas",
    "Canceladas",
    "Atendidos",
    "Ausentes",
    "Sin registrar",
  ];
  const fila = (x: ResultadoReporteOcupacion["porMedico"][number]): Celda[] => [
    x.nombre,
    x.especialidad ?? "",
    x.ocupacion.cuposPublicados,
    x.ocupacion.cuposBloqueados,
    x.ocupacion.cuposUtilizables,
    x.ocupacion.cuposOcupados,
    x.ocupacion.porcentajeOcupacion,
    x.reservas.confirmadas,
    x.reservas.canceladas,
    x.reservas.atendidos,
    x.reservas.ausentes,
    x.reservas.sinRegistrar,
  ];
  return {
    ...base("Turnos asignados y ocupación de agenda", r.periodo, ahora, [
      ["Médico", valorFiltro(f.medicoId)],
      ["Especialidad", valorFiltro(f.especialidadId)],
      ["Estado", valorFiltro(f.estado)],
      ["Modalidad", valorFiltro(f.modalidad)],
    ]),
    totales: [
      ["Cupos publicados", r.ocupacion.cuposPublicados],
      ["Cupos bloqueados", r.ocupacion.cuposBloqueados],
      ["Cupos utilizables", r.ocupacion.cuposUtilizables],
      ["Cupos ocupados", r.ocupacion.cuposOcupados],
      ["Porcentaje de ocupación", r.ocupacion.porcentajeOcupacion],
      ["Reservas confirmadas", r.reservas.confirmadas],
      ["Reservas canceladas", r.reservas.canceladas],
      ["Atendidos", r.reservas.atendidos],
      ["Ausentes", r.reservas.ausentes],
      ["Sin registrar", r.reservas.sinRegistrar],
    ],
    tablas: [
      { titulo: "Por médico", columnas, filas: r.porMedico.map(fila) },
      {
        titulo: "Por especialidad",
        columnas,
        filas: r.porEspecialidad.map(fila),
      },
    ],
  };
}

export function proyectarInventario(
  r: ResultadoReporteInventario,
  f: FiltrosReporteInventario,
  ahora: Date,
): DocumentoExportado {
  const saldos = r.resumen.reduce(
    (a, x) => ({
      inicial: a.inicial + x.saldoInicial,
      entradas: a.entradas + x.entradas,
      ajustes: a.ajustes + x.ajustes,
      final: a.final + x.saldoFinal,
    }),
    { inicial: 0, entradas: 0, ajustes: 0, final: 0 },
  );
  return {
    ...base("Inventario de vacunas y evolución", r.periodo, ahora, [
      ["Vacuna", valorFiltro(f.vacunaId, "Todas")],
      ["Lote", valorFiltro(f.loteId)],
      ["Tipo de movimiento (solo detalle)", valorFiltro(f.tipo)],
    ]),
    totales: [
      [
        "Dosis físicas actuales",
        r.stockActual.reduce((n, x) => n + x.fisico, 0),
      ],
      ["Vacunas", r.stockActual.length],
      ["Lotes", r.stockActual.reduce((n, x) => n + x.lotes.length, 0)],
      ["Saldo inicial del período", saldos.inicial],
      ["Entradas del período", saldos.entradas],
      ["Ajustes del período", saldos.ajustes],
      ["Saldo final del período", saldos.final],
      ["Movimientos del detalle", r.totalMovimientos],
    ],
    tablas: [
      {
        titulo: "Stock actual por vacuna y lote",
        columnas: ["Vacuna", "Lote", "Vencimiento", "Físico"],
        filas: r.stockActual.flatMap((v) =>
          v.lotes.length
            ? v.lotes.map((l) => [
                v.nombre,
                l.codigo,
                l.fechaVencimiento,
                l.fisico,
              ])
            : [[v.nombre, "", "", v.fisico]],
        ),
      },
      {
        titulo: "Saldos del período",
        columnas: [
          "Vacuna",
          "Lote",
          "Saldo inicial",
          "Entradas",
          "Ajustes",
          "Saldo final",
        ],
        filas: r.resumen.map((x) => [
          x.vacuna,
          x.lote,
          x.saldoInicial,
          x.entradas,
          x.ajustes,
          x.saldoFinal,
        ]),
      },
      {
        titulo: "Movimientos del período",
        columnas: [
          "Fecha",
          "Vacuna",
          "Lote",
          "Tipo",
          "Cantidad",
          "Motivo",
          "Operador",
        ],
        filas: r.movimientos.map((x) => [
          x.fecha,
          x.vacuna,
          x.lote,
          x.tipo,
          x.cantidad,
          x.motivo ?? "",
          x.operador,
        ]),
      },
    ],
    notas: [
      "El stock actual corresponde al momento de generación. El filtro por tipo se aplica solo al detalle de movimientos.",
    ],
  };
}

export function proyectarCobertura(
  r: ResultadoReporteCobertura,
  f: FiltrosReporteCobertura,
  ahora: Date,
): DocumentoExportado {
  return {
    ...base("Prestaciones con cobertura", r.periodo, ahora, [
      ["Médico", valorFiltro(f.medicoId)],
      ["Especialidad", valorFiltro(f.especialidadId)],
      ["Entidad de cobertura", valorFiltro(f.obraSocialId, "Todas")],
      ["Categoría", valorFiltro(f.categoria, "Todas")],
    ]),
    totales: [
      ["Prestaciones", r.totales.total],
      ["Particular", r.totales.particular],
      ["Gratuita", r.totales.gratuita],
      ["Con cobertura registrada", r.totales.conCobertura],
    ],
    tablas: [
      {
        titulo: "Por médico",
        columnas: [
          "Médico",
          "Especialidad",
          "Total",
          "Particular",
          "Gratuita",
          "Con cobertura",
        ],
        filas: r.porMedico.map((x) => [
          x.nombre,
          x.especialidad,
          x.conteo.total,
          x.conteo.particular,
          x.conteo.gratuita,
          x.conteo.conCobertura,
        ]),
      },
      {
        titulo: "Por entidad",
        columnas: ["Entidad", "Prestaciones"],
        filas: r.porEntidad.map((x) => [x.nombre, x.prestaciones]),
      },
      {
        titulo: "Detalle de prestaciones",
        columnas: [
          "Fecha",
          "Hora",
          "Paciente",
          "DNI",
          "Profesional",
          "Especialidad",
          "Prestación",
          "Categoría",
          "Cobertura",
          "Plan",
          "Arancel de referencia",
        ],
        filas: r.prestaciones.map((x) => [
          x.fecha,
          x.hora,
          x.paciente,
          x.dni,
          x.profesional,
          x.especialidad,
          x.prestacion,
          x.categoria,
          x.cobertura ?? "",
          x.plan ?? "",
          x.arancelReferencia,
        ]),
      },
    ],
    notas: [
      "La cobertura registrada no representa un pago recibido. El arancel es solo una referencia.",
    ],
  };
}
