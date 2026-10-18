"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ETIQUETA_ESTADO_CITA,
  ETIQUETA_RESULTADO_ATENCION,
} from "@/lib/agenda/etiquetas";
import { etiquetaFecha } from "@/lib/agenda/reglas";
import type { TurnoLista } from "@/lib/turnos/consulta-turnos";
import { AccionesCancelacion } from "@/components/paciente/CancelarCitaDialog";
import type { EstadoTurnoAgenda, ResultadoAgenda } from "@/lib/agenda/tipos";

export type FiltrosTurnosVista = {
  beneficiario: string;
  periodo: "proximos" | "pasados" | "todos";
  estado: "confirmado" | "cancelado" | "todos";
  resultado: "sin_registrar" | "atendido" | "ausente" | "todos";
  especialidad?: string;
  vacuna?: string;
};

type Beneficiario = {
  id: string;
  nombre: string;
  tipo: string;
};

type Props = {
  beneficiarios: Beneficiario[];
  beneficiarioSeleccionado: string;
  filtros: FiltrosTurnosVista;
  proximos: TurnoLista[];
  antecedentes: TurnoLista[];
  especialidades: { id: string; nombre: string }[];
  vacunas: { id: string; nombre: string }[];
};

const placeholder = (texto: string) => (
  <p className="sigsam-muted" style={{ marginTop: 0 }}>
    {texto}
  </p>
);

function fechaConHora(fecha: string, hora: string) {
  return `${etiquetaFecha(fecha)} · ${hora} hs`;
}

function cobroEtiqueta(situacion: TurnoLista["situacionCobro"]) {
  switch (situacion) {
    case "COBRADA":
      return "Cobrada";
    case "SIN_COBRAR":
      return "Sin cobrar";
    case "SIN_COBRO_PACIENTE":
      return "Sin cobro al paciente";
    default:
      return "";
  }
}

function construirUrl(base: string, filtros: FiltrosTurnosVista) {
  const params = new URLSearchParams();
  params.set("beneficiario", filtros.beneficiario);
  if (filtros.periodo !== "proximos") params.set("periodo", filtros.periodo);
  if (filtros.estado !== "todos") params.set("estado", filtros.estado);
  if (filtros.resultado !== "todos") params.set("resultado", filtros.resultado);
  if (filtros.especialidad) params.set("especialidad", filtros.especialidad);
  if (filtros.vacuna) params.set("vacuna", filtros.vacuna);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function TurnosView({
  beneficiarios,
  beneficiarioSeleccionado,
  filtros,
  proximos,
  antecedentes,
  especialidades,
  vacunas,
}: Props) {
  const router = useRouter();

  const actualizarFiltro = (partial: Partial<FiltrosTurnosVista>) => {
    const nuevos = { ...filtros, ...partial };
    router.replace(construirUrl("/paciente/turnos", nuevos));
  };

  return (
    <div>
      <div className="sigsam-card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Beneficiario</h2>
        <div className="sigsam-field">
          <label htmlFor="beneficiario">Seleccionar</label>
          <select
            id="beneficiario"
            value={beneficiarioSeleccionado}
            onChange={(e) => actualizarFiltro({ beneficiario: e.target.value })}
          >
            {beneficiarios.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre} — {b.tipo}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="sigsam-card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Filtros</h2>
        <div className="sigsam-grid cols-2">
          <div className="sigsam-field">
            <label htmlFor="periodo">Período</label>
            <select
              id="periodo"
              value={filtros.periodo}
              onChange={(e) =>
                actualizarFiltro({
                  periodo: e.target.value as "proximos" | "pasados" | "todos",
                })
              }
            >
              <option value="proximos">Próximos turnos</option>
              <option value="pasados">Antecedentes</option>
              <option value="todos">Todos</option>
            </select>
          </div>
          <div className="sigsam-field">
            <label htmlFor="estado">Estado</label>
            <select
              id="estado"
              value={filtros.estado}
              onChange={(e) =>
                actualizarFiltro({
                  estado: e.target.value as
                    "confirmado" | "cancelado" | "todos",
                })
              }
            >
              <option value="todos">Todos</option>
              <option value="confirmado">Confirmado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          <div className="sigsam-field">
            <label htmlFor="resultado">Resultado</label>
            <select
              id="resultado"
              value={filtros.resultado}
              onChange={(e) =>
                actualizarFiltro({
                  resultado: e.target.value as
                    "sin_registrar" | "atendido" | "ausente" | "todos",
                })
              }
            >
              <option value="todos">Todos</option>
              <option value="sin_registrar">Sin registrar</option>
              <option value="atendido">Atendido</option>
              <option value="ausente">Ausente</option>
            </select>
          </div>
          <div className="sigsam-field">
            <label htmlFor="especialidad">Especialidad</label>
            <select
              id="especialidad"
              value={filtros.especialidad ?? ""}
              onChange={(e) =>
                actualizarFiltro({ especialidad: e.target.value || undefined })
              }
            >
              <option value="">Todas</option>
              {especialidades.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="sigsam-field">
            <label htmlFor="vacuna">Vacuna</label>
            <select
              id="vacuna"
              value={filtros.vacuna ?? ""}
              onChange={(e) =>
                actualizarFiltro({ vacuna: e.target.value || undefined })
              }
            >
              <option value="">Todas</option>
              {vacunas.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <section>
        <h2>Próximos turnos</h2>
        {proximos.length === 0 && placeholder("No hay turnos próximos.")}
        {proximos.map((t) => (
          <div key={t.id} className="sigsam-card" style={{ marginBottom: 12 }}>
            <h3 style={{ marginTop: 0 }}>{t.prestacion}</h3>
            <p style={{ margin: "4px 0" }}>
              <strong>Fecha y hora:</strong> {fechaConHora(t.fecha, t.hora)}
            </p>
            <p style={{ margin: "4px 0" }}>
              <strong>Profesional:</strong> {t.profesional}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="sigsam-pill">
                {ETIQUETA_ESTADO_CITA[t.estado as EstadoTurnoAgenda]}
              </span>
              {t.resultadoVisible && (
                <span className="sigsam-pill">
                  {ETIQUETA_RESULTADO_ATENCION[t.resultado as ResultadoAgenda]}
                </span>
              )}
              <span className="sigsam-pill">
                {cobroEtiqueta(t.situacionCobro)}
              </span>
            </div>
            {t.pendienteDeResolver && (
              <div className="sigsam-notice info" style={{ marginTop: 12 }}>
                <span className="sigsam-notice-symbol">i</span>
                <p style={{ margin: 0 }}>
                  Esta cita requiere resolución: la jornada está suspendida.
                </p>
              </div>
            )}
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 12,
              }}
            >
              <Link
                href={`/paciente/turnos/${t.id}`}
                className="sigsam-btn secondary"
              >
                Ver detalle
              </Link>
              {t.facturaDisponible && (
                <Link
                  href={`/api/paciente/turnos/${t.id}/comprobante`}
                  download
                  className="sigsam-btn secondary"
                >
                  Descargar factura
                </Link>
              )}
              <AccionesCancelacion
                cita={{
                  id: t.id,
                  beneficiarioNombre: t.beneficiarioNombre,
                  prestacion: t.prestacion,
                  fecha: t.fecha,
                  hora: t.hora,
                  profesional: t.profesional,
                  pendienteDeResolver: t.pendienteDeResolver,
                  motivoSuspension: t.motivoSuspension,
                }}
                cancelable={t.cancelable}
                cancelableMotivo={t.cancelableMotivo}
                etiqueta="Cancelar"
                mostrarNota={false}
                mostrarMotivoNoCancelable={t.estado === "CONFIRMADO"}
              />
            </div>
          </div>
        ))}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Antecedentes</h2>
        {antecedentes.length === 0 &&
          placeholder("Todavía no hay turnos anteriores.")}
        {antecedentes.map((t) => (
          <div key={t.id} className="sigsam-card" style={{ marginBottom: 12 }}>
            <h3 style={{ marginTop: 0 }}>{t.prestacion}</h3>
            <p style={{ margin: "4px 0" }}>
              <strong>Fecha y hora:</strong> {fechaConHora(t.fecha, t.hora)}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="sigsam-pill">
                {ETIQUETA_ESTADO_CITA[t.estado as EstadoTurnoAgenda]}
              </span>
              {t.resultadoVisible && (
                <span className="sigsam-pill">
                  {ETIQUETA_RESULTADO_ATENCION[t.resultado as ResultadoAgenda]}
                </span>
              )}
              <span className="sigsam-pill">
                {cobroEtiqueta(t.situacionCobro)}
              </span>
            </div>
            <div style={{ marginTop: 12 }}>
              <Link
                href={`/paciente/turnos/${t.id}`}
                className="sigsam-btn secondary"
              >
                Ver detalle
              </Link>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
