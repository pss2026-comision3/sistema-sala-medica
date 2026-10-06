import Link from "next/link";

import {
  ETIQUETA_ESTADO_CITA,
  ETIQUETA_RESULTADO_ATENCION,
} from "@/lib/agenda/etiquetas";
import {
  etiquetaFecha,
  hoySala,
  sumarDias,
  sumarMeses,
} from "@/lib/agenda/reglas";
import type {
  DiaAgenda,
  FiltrosAgenda,
  JornadaAgenda,
  MedicoAgenda,
} from "@/lib/agenda/tipos";

type Props = {
  dias: DiaAgenda[];
  filtros: FiltrosAgenda;
  /** Ruta de la propia agenda: "/medico" o "/admin/agenda". */
  basePath: string;
  /** CA3: solo el médico abre la ficha de sus citas confirmadas. Administración no. */
  verFicha: boolean;
  /** Solo administración: médico que se está consultando (CA5). */
  medicos?: MedicoAgenda[];
  medicoSeleccionado?: string;
};

function construirUrl(
  basePath: string,
  filtros: FiltrosAgenda,
  medicoSeleccionado: string | undefined,
  cambios: Partial<FiltrosAgenda> = {},
): string {
  const f = { ...filtros, ...cambios };
  const params = new URLSearchParams();
  params.set("vista", f.vista);
  params.set("fecha", f.fecha);
  if (f.estado !== "todos") params.set("estado", f.estado);
  if (f.resultado !== "todos") params.set("resultado", f.resultado);
  if (medicoSeleccionado) params.set("medico", medicoSeleccionado);
  return `${basePath}?${params.toString()}`;
}

function JornadaBloque({ jornada }: { jornada: JornadaAgenda }) {
  if (jornada.estado === "SUSPENDIDA") {
    return (
      <div className="sigsam-notice warning" style={{ marginBottom: "12px" }}>
        <span className="sigsam-notice-symbol" aria-hidden="true">
          !
        </span>
        <div>
          <strong>
            Jornada suspendida ({jornada.horaDesde} a {jornada.horaHasta} hs)
          </strong>
          <p style={{ margin: 0, fontSize: "14px" }}>
            Las citas confirmadas quedan pendientes de resolución
            administrativa.
          </p>
        </div>
      </div>
    );
  }
  return (
    <p className="sigsam-muted" style={{ marginTop: 0 }}>
      Jornada publicada: {jornada.horaDesde} a {jornada.horaHasta} hs
    </p>
  );
}

export function AgendaMedicaView({
  dias,
  filtros,
  basePath,
  verFicha,
  medicos,
  medicoSeleccionado,
}: Props) {
  const hoy = hoySala();
  const avanzar = (sentido: 1 | -1) =>
    filtros.vista === "mes"
      ? sumarMeses(filtros.fecha, sentido)
      : sumarDias(filtros.fecha, sentido);

  return (
    <>
      {/* [MOCK-US010] Aviso temporal: quitar al reemplazar el mock por datos reales. */}
      <div className="sigsam-notice warning" style={{ marginBottom: "20px" }}>
        <span className="sigsam-notice-symbol" aria-hidden="true">
          !
        </span>
        <div>
          <strong>Datos de demostración</strong>
          <p style={{ margin: 0, fontSize: "14px" }}>
            Las jornadas y los turnos todavía no vienen de la base de datos. Se
            reemplazan al implementar US-009, US-012, US-016 y US-017.
          </p>
        </div>
      </div>

      <div className="sigsam-section-head">
        <nav
          aria-label="Vista de agenda"
          style={{ display: "flex", gap: "8px" }}
        >
          <Link
            href={construirUrl(basePath, filtros, medicoSeleccionado, {
              vista: "dia",
            })}
            className={
              filtros.vista === "dia"
                ? "sigsam-btn small"
                : "sigsam-btn secondary small"
            }
            aria-current={filtros.vista === "dia" ? "page" : undefined}
          >
            Día
          </Link>
          <Link
            href={construirUrl(basePath, filtros, medicoSeleccionado, {
              vista: "mes",
            })}
            className={
              filtros.vista === "mes"
                ? "sigsam-btn small"
                : "sigsam-btn secondary small"
            }
            aria-current={filtros.vista === "mes" ? "page" : undefined}
          >
            Mes
          </Link>
        </nav>
        <nav
          aria-label="Navegar fechas"
          style={{ display: "flex", gap: "8px" }}
        >
          <Link
            href={construirUrl(basePath, filtros, medicoSeleccionado, {
              fecha: avanzar(-1),
            })}
            className="sigsam-btn ghost small"
          >
            ← Anterior
          </Link>
          <Link
            href={construirUrl(basePath, filtros, medicoSeleccionado, {
              fecha: hoy,
            })}
            className="sigsam-btn ghost small"
          >
            Hoy
          </Link>
          <Link
            href={construirUrl(basePath, filtros, medicoSeleccionado, {
              fecha: avanzar(1),
            })}
            className="sigsam-btn ghost small"
          >
            Siguiente →
          </Link>
        </nav>
      </div>

      <form
        method="get"
        action={basePath}
        className="sigsam-card"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "flex-end",
        }}
      >
        <input type="hidden" name="vista" value={filtros.vista} />
        {medicos && (
          <div className="sigsam-field">
            <label htmlFor="filtro-medico">Médico</label>
            <select
              id="filtro-medico"
              name="medico"
              defaultValue={medicoSeleccionado}
            >
              {medicos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre} ({m.especialidad})
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="sigsam-field">
          <label htmlFor="filtro-fecha">Fecha</label>
          <input
            id="filtro-fecha"
            type="date"
            name="fecha"
            defaultValue={filtros.fecha}
          />
        </div>
        <div className="sigsam-field">
          <label htmlFor="filtro-estado">Estado</label>
          <select
            id="filtro-estado"
            name="estado"
            defaultValue={filtros.estado}
          >
            <option value="todos">Todos</option>
            <option value="reservado">Retención temporal</option>
            <option value="confirmado">Confirmado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
        <div className="sigsam-field">
          <label htmlFor="filtro-resultado">Resultado</label>
          <select
            id="filtro-resultado"
            name="resultado"
            defaultValue={filtros.resultado}
          >
            <option value="todos">Todos</option>
            <option value="sin_registrar">Sin resultado</option>
            <option value="atendido">Atendido</option>
            <option value="ausente">Ausente</option>
          </select>
        </div>
        <button type="submit" className="sigsam-btn small">
          Aplicar
        </button>
      </form>

      {dias.length === 0 ? (
        <div className="sigsam-empty">
          <p>No hay jornadas ni turnos para estos filtros.</p>
        </div>
      ) : (
        dias.map((dia) => (
          <section
            key={dia.fecha}
            className="sigsam-card"
            style={{ marginTop: "16px" }}
          >
            <h2 style={{ textTransform: "capitalize" }}>
              {etiquetaFecha(dia.fecha)}
            </h2>

            {dia.jornadas.map((j) => (
              <JornadaBloque key={`${j.fecha}-${j.horaDesde}`} jornada={j} />
            ))}

            {dia.turnos.length === 0 ? (
              <p className="sigsam-muted">Sin turnos con este filtro.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {dia.turnos.map((t) => (
                  <li
                    key={t.id}
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "12px",
                      alignItems: "center",
                      padding: "10px 0",
                      borderTop: "1px solid var(--color-line)",
                    }}
                  >
                    <time style={{ fontWeight: 700, minWidth: "56px" }}>
                      {t.hora}
                    </time>
                    <div style={{ flex: "1 1 220px" }}>
                      <strong>{t.paciente.nombre}</strong>
                      <div
                        className="sigsam-muted"
                        style={{ fontSize: "14px" }}
                      >
                        DNI {t.paciente.dni} ·{" "}
                        {t.paciente.obraSocial ?? "Particular"}
                      </div>
                    </div>
                    <span>{ETIQUETA_ESTADO_CITA[t.estado]}</span>
                    <span>{ETIQUETA_RESULTADO_ATENCION[t.resultado]}</span>
                    {t.pendienteDeResolver && (
                      <span
                        style={{
                          color: "var(--color-warning)",
                          fontWeight: 700,
                        }}
                      >
                        Pendiente de resolver
                      </span>
                    )}
                    {verFicha && t.estado === "CONFIRMADO" && (
                      <Link
                        href={`/medico/turnos/${t.id}`}
                        className="sigsam-btn secondary small"
                      >
                        Abrir ficha
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}

      {!verFicha && (
        <p className="sigsam-muted" style={{ marginTop: "16px" }}>
          Vista de gestión: no muestra diagnósticos ni documentos clínicos.
        </p>
      )}
    </>
  );
}
