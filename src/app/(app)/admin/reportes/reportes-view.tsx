"use client";

import { useState, useTransition } from "react";
import { CATALOGO_REPORTES, type TipoReporte } from "@/lib/reportes/registry";
import type {
  MedicoOpcion,
  OpcionSelector,
  ResultadoReporteAsistencia,
} from "@/lib/reportes/tipos";
import { obtenerReporteAsistenciaAction } from "@/app/actions/reportes";
import { VistaAsistenciaReporte } from "./vista-asistencia";

interface Props {
  medicos: MedicoOpcion[];
  especialidades: OpcionSelector[];
  fechaHoy: string;
  fechaDesdeDefecto: string;
  reporteInicial: ResultadoReporteAsistencia;
}

export function ReportesView({
  medicos,
  especialidades,
  fechaHoy,
  fechaDesdeDefecto,
  reporteInicial,
}: Props) {
  const [tipoReporte, setTipoReporte] = useState<TipoReporte>(
    "asistencia_recordatorios",
  );
  const [desde, setDesde] = useState(fechaDesdeDefecto);
  const [hasta, setHasta] = useState(fechaHoy);
  const [medicoId, setMedicoId] = useState("todos");
  const [especialidadId, setEspecialidadId] = useState("todos");

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoReporteAsistencia | null>(
    reporteInicial,
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await obtenerReporteAsistenciaAction({
        desde,
        hasta,
        medicoId: medicoId !== "todos" ? medicoId : undefined,
        especialidadId: especialidadId !== "todos" ? especialidadId : undefined,
      });

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
                onChange={(e) => setTipoReporte(e.target.value as TipoReporte)}
              >
                {CATALOGO_REPORTES.map((rep) => (
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
          {tipoReporte === "asistencia_recordatorios" && (
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
                  Especialidad {especialidadBloqueada && "(fijada por médico)"}
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
                    Especialidad fijada por el médico. Seleccioná &quot;Todos
                    los médicos&quot; para cambiarla.
                  </span>
                )}
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
    </div>
  );
}
