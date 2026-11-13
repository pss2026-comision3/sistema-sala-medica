"use client";

import { useState, useTransition } from "react";
import { CATALOGO_REPORTES, type TipoReporte } from "@/lib/reportes/registry";
import type {
  EstadoFiltroOcupacion,
  MedicoOpcion,
  ModalidadFiltroOcupacion,
  OpcionSelector,
  OpcionVacunaInventario,
  ResultadoReporteAsistencia,
  ResultadoReporteOcupacion,
  ResultadoReporteInventario,
  TipoMovimientoReporte,
} from "@/lib/reportes/tipos";
import {
  obtenerReporteAsistenciaAction,
  obtenerReporteOcupacionAction,
  obtenerReporteInventarioAction,
} from "@/app/actions/reportes";
import { VistaAsistenciaReporte } from "./vista-asistencia";
import { VistaOcupacionReporte } from "./vista-ocupacion";
import { VistaInventarioReporte } from "./vista-inventario";

interface Props {
  medicos: MedicoOpcion[];
  especialidades: OpcionSelector[];
  fechaHoy: string;
  fechaDesdeDefecto: string;
  reporteInicial: ResultadoReporteAsistencia;
  modoMedico?: boolean; // true en /medico/reportes: oculta filtros de médico y especialidad
  opcionesInventario?: OpcionVacunaInventario[];
  reporteInventarioInicial?: ResultadoReporteInventario;
}

const TIPOS_MOVIMIENTO_FILTRO: {
  valor: TipoMovimientoReporte;
  etiqueta: string;
}[] = [
  { valor: "COMPRA", etiqueta: "Compras" },
  { valor: "AJUSTE", etiqueta: "Ajustes" },
  { valor: "APLICACION", etiqueta: "Aplicaciones" },
];

/*
 * Para agregar un nuevo tipo de reporte chequear Guia para agregar nuevos reportes
 * (Esta en esta mismo directorio de reportes)
 */

export function ReportesView({
  medicos,
  especialidades,
  fechaHoy,
  fechaDesdeDefecto,
  reporteInicial,
  modoMedico = false,
  opcionesInventario = [],
  reporteInventarioInicial,
}: Props) {
  const [tipoReporte, setTipoReporte] = useState<TipoReporte>(
    "asistencia_recordatorios",
  );
  const [desde, setDesde] = useState(fechaDesdeDefecto);
  const [hasta, setHasta] = useState(fechaHoy);
  const [medicoId, setMedicoId] = useState("todos");
  const [especialidadId, setEspecialidadId] = useState("todos");
  const [estado, setEstado] = useState<EstadoFiltroOcupacion>("todos");
  const [modalidad, setModalidad] = useState<ModalidadFiltroOcupacion>("todos");
  const [resultadoOcupacion, setResultadoOcupacion] =
    useState<ResultadoReporteOcupacion | null>(null);
  const [vacunaId, setVacunaId] = useState("todas");
  const [loteId, setLoteId] = useState("todos");
  const [tipoMovimiento, setTipoMovimiento] = useState("todos");

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoReporteAsistencia | null>(
    reporteInicial,
  );
  const [resultadoInventario, setResultadoInventario] =
    useState<ResultadoReporteInventario | null>(
      reporteInventarioInicial ?? null,
    );

  // Item 2: Al elegir una especialidad, solo deben aparecer los médicos de ella
  const medicosFiltrados =
    especialidadId === "todos"
      ? medicos
      : medicos.filter((m) => m.especialidadId === especialidadId);

  // Item 1: Al elegir un médico, la especialidad se fija automáticamente con la suya
  const handleMedicoChange = (nuevoMedicoId: string) => {
    setMedicoId(nuevoMedicoId);
    if (nuevoMedicoId !== "todos") {
      const med = medicos.find((m) => m.id === nuevoMedicoId);
      if (med?.especialidadId) {
        setEspecialidadId(med.especialidadId);
      }
    }
  };

  // Item 2: Al cambiar especialidad, si el médico seleccionado no pertenece a ella, se reinicia a 'todos'
  const handleEspecialidadChange = (nuevaEspecialidadId: string) => {
    setEspecialidadId(nuevaEspecialidadId);
    if (nuevaEspecialidadId !== "todos") {
      const med = medicos.find((m) => m.id === medicoId);
      if (med && med.especialidadId !== nuevaEspecialidadId) {
        setMedicoId("todos");
      }
    }
  };

  // Si hay un médico seleccionado, su especialidad única queda fijada y bloqueada
  const especialidadBloqueada = medicoId !== "todos";

  // Lotes disponibles según la vacuna elegida. Cuando no hay vacuna
  // seleccionada se listan todos, etiquetados con el nombre de su vacuna.
  const lotesDisponibles: {
    id: string;
    codigo: string;
    vacunaNombre: string | null;
  }[] =
    vacunaId === "todas"
      ? opcionesInventario.flatMap((vacuna) =>
          vacuna.lotes.map((lote) => ({
            id: lote.id,
            codigo: lote.codigo,
            vacunaNombre: vacuna.nombre,
          })),
        )
      : (
          opcionesInventario.find((vacuna) => vacuna.id === vacunaId)?.lotes ??
          []
        ).map((lote) => ({
          id: lote.id,
          codigo: lote.codigo,
          vacunaNombre: null,
        }));

  const handleVacunaChange = (nuevaVacunaId: string) => {
    setVacunaId(nuevaVacunaId);

    if (nuevaVacunaId === "todas" || loteId === "todos") return;

    const vacuna = opcionesInventario.find((v) => v.id === nuevaVacunaId);
    const pertenece =
      vacuna?.lotes.some((lote) => lote.id === loteId) ?? false;

    if (!pertenece) {
      setLoteId("todos");
    }
  };

  const handleTipoReporteChange = (nuevoTipo: TipoReporte) => {
    setTipoReporte(nuevoTipo);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const filtrosComunes = {
      desde,
      hasta,
      medicoId: medicoId !== "todos" ? medicoId : undefined,
      especialidadId: especialidadId !== "todos" ? especialidadId : undefined,
    };

    startTransition(async () => {
      if (tipoReporte === "inventario") {
        const res = await obtenerReporteInventarioAction({
          desde,
          hasta,
          vacunaId: vacunaId !== "todas" ? vacunaId : undefined,
          loteId: loteId !== "todos" ? loteId : undefined,
          tipo:
            tipoMovimiento !== "todos"
              ? (tipoMovimiento as TipoMovimientoReporte)
              : undefined,
        });

        if (!res.exito) {
          setError(res.error);
          setResultadoInventario(null);
        } else {
          setResultadoInventario(res.datos);
        }

        return;
      }

      if (tipoReporte === "turnos_ocupacion") {
        const res = await obtenerReporteOcupacionAction({
          ...filtrosComunes,
          estado,
          modalidad,
        });
        if (!res.exito) {
          setError(res.error);
          setResultadoOcupacion(null);
        } else {
          setResultadoOcupacion(res.datos);
        }
        return;
      }

      const res = await obtenerReporteAsistenciaAction(filtrosComunes);
      if (!res.exito) {
        setError(res.error);
        setResultado(null);
      } else {
        setResultado(res.datos);
      }
    });
  };

  return (
    <div>
      {/* Cabecera idéntica al mockup */}
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1
            style={{ fontSize: "28px", fontWeight: "800", margin: "0 0 6px" }}
          >
            Reportes
          </h1>
          <p>
            Analizá la actividad de la sala y descargá un extracto de
            demostración.
          </p>
        </div>
      </div>

      {/* Tarjeta de Filtros (Mockup) */}
      <section className="sigsam-card">
        <h2
          style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px" }}
        >
          Filtros
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Fila 1: Reporte *, Desde *, Hasta * */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "20px",
              marginBottom: "16px",
            }}
          >
            {/* Selector dinámico de Tipo de Reporte (Arquitectura Extensible) */}
            <div className="sigsam-field">
              <label htmlFor="tipoReporte">Reporte *</label>
              <select
                id="tipoReporte"
                value={tipoReporte}
                onChange={(e) =>
                  handleTipoReporteChange(e.target.value as TipoReporte)
                }
              >
                {CATALOGO_REPORTES.filter((rep) =>
                  rep.rolesPermitidos.includes(modoMedico ? "MEDICO" : "ADMIN"),
                ).map((rep) => (
                  <option key={rep.id} value={rep.id}>
                    {rep.titulo}
                  </option>
                ))}
              </select>
            </div>

            {/* Fecha Desde */}
            <div className="sigsam-field">
              <label htmlFor="desde">Desde *</label>
              <input
                id="desde"
                type="date"
                required
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>

            {/* Fecha Hasta */}
            <div className="sigsam-field">
              <label htmlFor="hasta">Hasta *</label>
              <input
                id="hasta"
                type="date"
                required
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>
          </div>

          {/* Fila 2: Filtros dinámicos específicos de Asistencia */}
          {(tipoReporte === "asistencia_recordatorios" ||
            tipoReporte === "turnos_ocupacion") && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "20px",
                marginBottom: "20px",
                alignItems: "start",
              }}
            >
              {!modoMedico && (
                <>
                  <div className="sigsam-field" style={{ minWidth: 0 }}>
                    <label htmlFor="medicoId">Médico</label>
                    <select
                      id="medicoId"
                      value={medicoId}
                      onChange={(e) => handleMedicoChange(e.target.value)}
                    >
                      <option value="todos">
                        {especialidadId === "todos"
                          ? "Todos los médicos"
                          : "Todos los médicos de esta especialidad"}
                      </option>
                      {medicosFiltrados.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filtro Especialidad */}
                  <div className="sigsam-field" style={{ minWidth: 0 }}>
                    <label htmlFor="especialidadId">
                      Especialidad{" "}
                      {especialidadBloqueada && "(fijada por médico)"}
                    </label>
                    <select
                      id="especialidadId"
                      value={especialidadId}
                      disabled={especialidadBloqueada}
                      onChange={(e) => handleEspecialidadChange(e.target.value)}
                      title={
                        especialidadBloqueada
                          ? "Fijada automáticamente según el médico seleccionado"
                          : undefined
                      }
                    >
                      <option value="todos">Todas las especialidades</option>
                      {especialidades.map((esp) => (
                        <option key={esp.id} value={esp.id}>
                          {esp.nombre}
                        </option>
                      ))}
                    </select>
                    {especialidadBloqueada && (
                      <span
                        className="sigsam-muted"
                        style={{
                          display: "block",
                          fontSize: "12px",
                          marginTop: "6px",
                          lineHeight: "1.3",
                        }}
                      >
                        Especialidad fijada por el médico. Seleccioná
                        &quot;Todos los médicos&quot; para cambiarla.
                      </span>
                    )}
                  </div>
                </>
              )}

              {modoMedico && (
                <p
                  className="sigsam-muted"
                  style={{ gridColumn: "1 / -1", margin: 0, fontSize: "14px" }}
                >
                  Estás viendo únicamente tus propios turnos.
                </p>
              )}

              {tipoReporte === "turnos_ocupacion" && (
                <>
                  <div className="sigsam-field" style={{ minWidth: 0 }}>
                    <label htmlFor="estado">Estado</label>
                    <select
                      id="estado"
                      value={estado}
                      onChange={(e) =>
                        setEstado(e.target.value as EstadoFiltroOcupacion)
                      }
                    >
                      <option value="todos">Todos</option>
                      <option value="CONFIRMADO">Confirmado</option>
                      <option value="CANCELADO">Cancelado</option>
                    </select>
                  </div>

                  <div className="sigsam-field" style={{ minWidth: 0 }}>
                    <label htmlFor="modalidad">Modalidad de cobertura</label>
                    <select
                      id="modalidad"
                      value={modalidad}
                      onChange={(e) =>
                        setModalidad(e.target.value as ModalidadFiltroOcupacion)
                      }
                    >
                      <option value="todos">Todas</option>
                      <option value="PARTICULAR">Particular</option>
                      <option value="CON_COBERTURA">
                        Con cobertura registrada
                      </option>
                    </select>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Fila 2: Filtros dinámicos específicos de Inventario */}
          {tipoReporte === "inventario" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "20px",
                marginBottom: "20px",
                alignItems: "start",
              }}
            >
              <div className="sigsam-field" style={{ minWidth: 0 }}>
                <label htmlFor="vacunaId">Vacuna</label>
                <select
                  id="vacunaId"
                  value={vacunaId}
                  onChange={(e) => handleVacunaChange(e.target.value)}
                >
                  <option value="todas">Todas las vacunas</option>
                  {opcionesInventario.map((vacuna) => (
                    <option key={vacuna.id} value={vacuna.id}>
                      {vacuna.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sigsam-field" style={{ minWidth: 0 }}>
                <label htmlFor="loteId">Lote</label>
                <select
                  id="loteId"
                  value={loteId}
                  onChange={(e) => setLoteId(e.target.value)}
                >
                  <option value="todos">Todos los lotes</option>
                  {lotesDisponibles.map((lote) => (
                    <option key={lote.id} value={lote.id}>
                      {lote.vacunaNombre
                        ? `${lote.vacunaNombre} · ${lote.codigo}`
                        : lote.codigo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sigsam-field" style={{ minWidth: 0 }}>
                <label htmlFor="tipoMovimiento">
                  Tipo (aplica al detalle)
                </label>
                <select
                  id="tipoMovimiento"
                  value={tipoMovimiento}
                  onChange={(e) => setTipoMovimiento(e.target.value)}
                >
                  <option value="todos">Todos los tipos</option>
                  {TIPOS_MOVIMIENTO_FILTRO.map((tipo) => (
                    <option key={tipo.valor} value={tipo.valor}>
                      {tipo.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Botón Aplicar filtros */}
          <div style={{ marginTop: "12px" }}>
            <button
              type="submit"
              disabled={isPending}
              className="sigsam-btn"
              style={{ minWidth: "140px" }}
            >
              {isPending ? "Generando..." : "Aplicar filtros"}
            </button>
          </div>
        </form>
      </section>

      {/* Mensajes de error */}
      {error && (
        <div style={{ marginTop: "20px" }}>
          <p className="sigsam-alert-error" role="alert">
            {error}
          </p>
        </div>
      )}

      {/* Resultados de US-035 con reinicio de paginación por cambio de búsqueda */}
      {tipoReporte === "asistencia_recordatorios" && resultado && (
        <VistaAsistenciaReporte
          key={`${resultado.periodo.desde}-${resultado.periodo.hasta}-${medicoId}-${especialidadId}`}
          resultado={resultado}
        />
      )}

      {tipoReporte === "turnos_ocupacion" && resultadoOcupacion && (
        <VistaOcupacionReporte resultado={resultadoOcupacion} />
      )}

      {tipoReporte === "turnos_ocupacion" && !resultadoOcupacion && !error && (
        <div className="sigsam-empty" style={{ marginTop: "24px" }}>
          <p>
            Elegí el período y tocá &quot;Aplicar filtros&quot; para generar el
            reporte.
          </p>
        </div>
      )}

      {/* Resultados de US-036 */}
      {tipoReporte === "inventario" && resultadoInventario && (
        <VistaInventarioReporte
          key={`${resultadoInventario.periodo.desde}-${resultadoInventario.periodo.hasta}-${vacunaId}-${loteId}-${tipoMovimiento}`}
          resultado={resultadoInventario}
        />
      )}
    </div>
  );
}
