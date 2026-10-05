"use client";

import { useState, useTransition } from "react";

import {
  actualizarConfiguracionMedico,
  actualizarArancelVacuna,
} from "@/app/actions/parametros";

export type MedicoItem = {
  usuarioId: string;
  nombre: string;
  email: string;
  especialidad: string;
  duracionTurnoMin: number;
  arancelActual: number;
  activo: boolean;
};

export type VacunaItem = {
  id: string;
  nombre: string;
  descripcion: string | null;
  arancelActual: number;
  umbralMinimo: number;
  activa: boolean;
};

type Props = {
  medicosIniciales: MedicoItem[];
  vacunasIniciales: VacunaItem[];
};

export function AdminParametrosView({
  medicosIniciales,
  vacunasIniciales,
}: Props) {
  const [tab, setTab] = useState<"medicos" | "vacunatorio">("medicos");
  const [medicos, setMedicos] = useState<MedicoItem[]>(medicosIniciales);
  const [vacunas, setVacunas] = useState<VacunaItem[]>(vacunasIniciales);

  // Estado del modal de edición de médico
  const [medicoParaEditar, setMedicoParaEditar] = useState<MedicoItem | null>(
    null,
  );
  const [inputDuracion, setInputDuracion] = useState<string>("");
  const [inputArancelMedico, setInputArancelMedico] = useState<string>("");

  // Estado del modal de edición de vacuna
  const [vacunaParaEditar, setVacunaParaEditar] = useState<VacunaItem | null>(
    null,
  );
  const [inputArancelVacuna, setInputArancelVacuna] = useState<string>("");

  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function abrirEdicionMedico(m: MedicoItem) {
    setErrorAccion(null);
    setMensajeExito(null);
    setMedicoParaEditar(m);
    setInputDuracion(String(m.duracionTurnoMin));
    setInputArancelMedico(m.arancelActual.toFixed(2));
  }

  function abrirEdicionVacuna(v: VacunaItem) {
    setErrorAccion(null);
    setMensajeExito(null);
    setVacunaParaEditar(v);
    setInputArancelVacuna(v.arancelActual.toFixed(2));
  }

  function handleGuardarMedico(e: React.FormEvent) {
    e.preventDefault();
    if (!medicoParaEditar) return;
    setErrorAccion(null);

    const duracionNum = Number(inputDuracion);
    const arancelNum = Number(inputArancelMedico);

    if (
      isNaN(duracionNum) ||
      !Number.isInteger(duracionNum) ||
      duracionNum <= 0
    ) {
      setErrorAccion(
        "La duración debe ser un número entero mayor a 0 minutos.",
      );
      return;
    }

    if (isNaN(arancelNum) || arancelNum < 0) {
      setErrorAccion("El arancel debe ser un importe mayor o igual a 0.");
      return;
    }

    startTransition(async () => {
      const res = await actualizarConfiguracionMedico({
        medicoUsuarioId: medicoParaEditar.usuarioId,
        duracionMin: duracionNum,
        arancel: arancelNum,
      });

      if (res.error) {
        setErrorAccion(res.error);
      } else {
        setMedicos((prev) =>
          prev.map((item) =>
            item.usuarioId === medicoParaEditar.usuarioId
              ? {
                  ...item,
                  duracionTurnoMin: duracionNum,
                  arancelActual: arancelNum,
                }
              : item,
          ),
        );
        setMensajeExito(
          res.mensaje ?? "Configuración del médico actualizada con éxito.",
        );
        setMedicoParaEditar(null);
      }
    });
  }

  function handleGuardarVacuna(e: React.FormEvent) {
    e.preventDefault();
    if (!vacunaParaEditar) return;
    setErrorAccion(null);

    const arancelNum = Number(inputArancelVacuna);

    if (isNaN(arancelNum) || arancelNum < 0) {
      setErrorAccion(
        "El arancel de la vacuna debe ser un importe mayor o igual a 0.",
      );
      return;
    }

    startTransition(async () => {
      const res = await actualizarArancelVacuna({
        vacunaId: vacunaParaEditar.id,
        arancel: arancelNum,
      });

      if (res.error) {
        setErrorAccion(res.error);
      } else {
        setVacunas((prev) =>
          prev.map((item) =>
            item.id === vacunaParaEditar.id
              ? { ...item, arancelActual: arancelNum }
              : item,
          ),
        );
        setMensajeExito(
          res.mensaje ?? "Arancel de la vacuna actualizado con éxito.",
        );
        setVacunaParaEditar(null);
      }
    });
  }

  const formatoMoneda = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  });

  return (
    <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
      {/* Mensajes de retroalimentación global */}
      {mensajeExito && (
        <div
          className="sigsam-notice success"
          role="status"
          style={{ marginBottom: "20px" }}
        >
          <span className="sigsam-notice-symbol" aria-hidden="true">
            ✓
          </span>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
            }}
          >
            <div>
              <strong>Actualización exitosa</strong>
              <p style={{ margin: 0, fontSize: "14px" }}>{mensajeExito}</p>
            </div>
            <button
              type="button"
              className="sigsam-btn ghost small"
              onClick={() => setMensajeExito(null)}
              aria-label="Cerrar aviso"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {errorAccion && !medicoParaEditar && !vacunaParaEditar && (
        <div
          className="sigsam-notice error"
          role="alert"
          style={{ marginBottom: "20px" }}
        >
          <span className="sigsam-notice-symbol" aria-hidden="true">
            !
          </span>
          <div>
            <strong>Error</strong>
            <p style={{ margin: 0, fontSize: "14px" }}>{errorAccion}</p>
          </div>
        </div>
      )}

      {/* Reglas de negocio vigentes */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div className="sigsam-notice info" style={{ margin: 0 }}>
          <span className="sigsam-notice-symbol" aria-hidden="true">
            i
          </span>
          <div>
            <strong>Vigencia e historial de turnos</strong>
            <p style={{ fontSize: "13px", marginTop: "4px" }}>
              Las citas confirmadas previamente conservan su duración y arancel
              históricos. Los cambios se aplicarán en futuras publicaciones de
              agenda y nuevas reservas.
            </p>
          </div>
        </div>

        <div className="sigsam-notice info" style={{ margin: 0 }}>
          <span className="sigsam-notice-symbol" aria-hidden="true">
            i
          </span>
          <div>
            <strong>Protocolo de vacunatorio</strong>
            <p style={{ fontSize: "13px", marginTop: "4px" }}>
              La duración de las aplicaciones de vacunación está fijada por
              protocolo en 15 minutos. El inventario y umbrales de stock son
              gestionados exclusivamente por Enfermería.
            </p>
          </div>
        </div>
      </div>

      {/* Selector de pestañas */}
      <div
        role="tablist"
        aria-label="Prestaciones para configuración"
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid var(--color-line, #d7e2e4)",
          marginBottom: "20px",
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "medicos"}
          aria-controls="panel-medicos"
          id="tab-medicos"
          onClick={() => {
            setTab("medicos");
            setErrorAccion(null);
          }}
          className={`sigsam-btn ${tab === "medicos" ? "" : "ghost"}`}
          style={{
            borderRadius: "6px 6px 0 0",
            borderBottom:
              tab === "medicos"
                ? "2px solid var(--color-brand, #145f65)"
                : "none",
            backgroundColor: tab === "medicos" ? "white" : "transparent",
            color: "var(--color-ink, #18323a)",
            fontWeight: tab === "medicos" ? 600 : 500,
          }}
        >
          Consultas médicas ({medicos.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tab === "vacunatorio"}
          aria-controls="panel-vacunatorio"
          id="tab-vacunatorio"
          onClick={() => {
            setTab("vacunatorio");
            setErrorAccion(null);
          }}
          className={`sigsam-btn ${tab === "vacunatorio" ? "" : "ghost"}`}
          style={{
            borderRadius: "6px 6px 0 0",
            borderBottom:
              tab === "vacunatorio"
                ? "2px solid var(--color-brand, #145f65)"
                : "none",
            backgroundColor: tab === "vacunatorio" ? "white" : "transparent",
            color: "var(--color-ink, #18323a)",
            fontWeight: tab === "vacunatorio" ? 600 : 500,
          }}
        >
          Vacunatorio ({vacunas.length})
        </button>
      </div>

      {/* Pestaña 1: Médicos */}
      {tab === "medicos" && (
        <section
          id="panel-medicos"
          role="tabpanel"
          aria-labelledby="tab-medicos"
          className="sigsam-card"
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <div>
              <div className="sigsam-eyebrow">Atención médica</div>
              <h2 style={{ fontSize: "20px", marginTop: "2px" }}>
                Duración y arancel por profesional
              </h2>
              <p
                className="sigsam-muted"
                style={{ fontSize: "14px", marginTop: "4px" }}
              >
                Configurá el intervalo de turnos y el arancel particular para
                cada médico.
              </p>
            </div>
          </div>

          {medicos.length === 0 ? (
            <div className="sigsam-empty">
              <p>No hay profesionales médicos registrados en el sistema.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: "14px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "2px solid var(--color-line, #d7e2e4)",
                      color: "var(--color-ink-muted, #5a737a)",
                    }}
                  >
                    <th style={{ padding: "10px 12px" }}>Profesional</th>
                    <th style={{ padding: "10px 12px" }}>Especialidad</th>
                    <th style={{ padding: "10px 12px" }}>Duración por turno</th>
                    <th style={{ padding: "10px 12px" }}>
                      Arancel de referencia
                    </th>
                    <th style={{ padding: "10px 12px", textAlign: "right" }}>
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {medicos.map((m) => (
                    <tr
                      key={m.usuarioId}
                      style={{
                        borderBottom: "1px solid var(--color-line, #d7e2e4)",
                      }}
                    >
                      <td style={{ padding: "12px" }}>
                        <strong style={{ display: "block" }}>{m.nombre}</strong>
                        <span
                          className="sigsam-muted"
                          style={{ fontSize: "13px" }}
                        >
                          {m.email}
                        </span>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            backgroundColor: "#e8eff1",
                            borderRadius: "12px",
                            fontSize: "12px",
                            fontWeight: 500,
                          }}
                        >
                          {m.especialidad}
                        </span>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <strong>{m.duracionTurnoMin} min</strong>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <strong>{formatoMoneda.format(m.arancelActual)}</strong>
                      </td>
                      <td style={{ padding: "12px", textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => abrirEdicionMedico(m)}
                          className="sigsam-btn secondary small"
                          aria-label={`Editar configuración de ${m.nombre}`}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Pestaña 2: Vacunas */}
      {tab === "vacunatorio" && (
        <section
          id="panel-vacunatorio"
          role="tabpanel"
          aria-labelledby="tab-vacunatorio"
          className="sigsam-card"
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <div>
              <div className="sigsam-eyebrow">Vacunatorio</div>
              <h2 style={{ fontSize: "20px", marginTop: "2px" }}>
                Aranceles de vacunas
              </h2>
              <p
                className="sigsam-muted"
                style={{ fontSize: "14px", marginTop: "4px" }}
              >
                La duración de turnos es fija (15 minutos). El arancel admite
                valor cero para aplicaciones gratuitas o del calendario oficial.
              </p>
            </div>
          </div>

          {vacunas.length === 0 ? (
            <div className="sigsam-empty">
              <p>No hay tipos de vacuna registrados en el sistema.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: "14px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "2px solid var(--color-line, #d7e2e4)",
                      color: "var(--color-ink-muted, #5a737a)",
                    }}
                  >
                    <th style={{ padding: "10px 12px" }}>Vacuna</th>
                    <th style={{ padding: "10px 12px" }}>Duración por turno</th>
                    <th style={{ padding: "10px 12px" }}>
                      Arancel de referencia
                    </th>
                    <th style={{ padding: "10px 12px", textAlign: "right" }}>
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vacunas.map((v) => (
                    <tr
                      key={v.id}
                      style={{
                        borderBottom: "1px solid var(--color-line, #d7e2e4)",
                      }}
                    >
                      <td style={{ padding: "12px" }}>
                        <strong style={{ display: "block" }}>{v.nombre}</strong>
                        {v.descripcion && (
                          <span
                            className="sigsam-muted"
                            style={{ fontSize: "13px" }}
                          >
                            {v.descripcion}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "13px",
                          }}
                        >
                          <strong>15 min</strong>
                          <span className="sigsam-muted">
                            (fijo por protocolo)
                          </span>
                        </span>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <strong>
                          {v.arancelActual === 0
                            ? "$ 0,00 (Gratuito)"
                            : formatoMoneda.format(v.arancelActual)}
                        </strong>
                      </td>
                      <td style={{ padding: "12px", textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => abrirEdicionVacuna(v)}
                          className="sigsam-btn secondary small"
                          aria-label={`Editar arancel de ${v.nombre}`}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Modal / Diálogo para editar Médico */}
      {medicoParaEditar && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-medico-title"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(16, 42, 49, 0.6)",
            display: "grid",
            placeItems: "center",
            padding: "16px",
            zIndex: 50,
          }}
        >
          <div
            className="sigsam-card"
            style={{
              maxWidth: "500px",
              width: "100%",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
          >
            <div className="sigsam-eyebrow">Configuración médica</div>
            <h2 id="modal-medico-title" style={{ fontSize: "20px" }}>
              Editar duración y arancel
            </h2>
            <p className="sigsam-muted" style={{ marginTop: "4px" }}>
              Profesional: <strong>{medicoParaEditar.nombre}</strong> (
              {medicoParaEditar.especialidad})
            </p>

            {errorAccion && (
              <div
                className="sigsam-notice error"
                role="alert"
                style={{ marginTop: "16px" }}
              >
                <span className="sigsam-notice-symbol" aria-hidden="true">
                  !
                </span>
                <div>
                  <strong>Validación</strong>
                  <p style={{ margin: 0, fontSize: "13px" }}>{errorAccion}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleGuardarMedico} style={{ marginTop: "16px" }}>
              <div className="sigsam-field">
                <label htmlFor="input-duracion">
                  Duración del turno (minutos)
                </label>
                <input
                  id="input-duracion"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={inputDuracion}
                  onChange={(e) => setInputDuracion(e.target.value)}
                  placeholder="Ej: 20"
                />
                <span className="hint">
                  Debe ser un número entero mayor a 0 minutos.
                </span>
              </div>

              <div className="sigsam-field" style={{ marginTop: "12px" }}>
                <label htmlFor="input-arancel-medico">
                  Arancel particular (ARS)
                </label>
                <input
                  id="input-arancel-medico"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={inputArancelMedico}
                  onChange={(e) => setInputArancelMedico(e.target.value)}
                  placeholder="0.00"
                />
                <span className="hint">
                  Importe en pesos. Admite cero y hasta dos decimales (sin
                  negativos).
                </span>
              </div>

              <div
                className="sigsam-notice info"
                style={{ marginTop: "16px", marginBottom: "20px" }}
              >
                <span className="sigsam-notice-symbol" aria-hidden="true">
                  i
                </span>
                <p style={{ margin: 0, fontSize: "12px" }}>
                  Las citas ya confirmadas mantendrán su arancel histórico. La
                  nueva duración se aplicará en las próximas publicaciones de
                  agenda.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={() => setMedicoParaEditar(null)}
                  className="sigsam-btn ghost"
                  disabled={isPending}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="sigsam-btn"
                  disabled={isPending}
                >
                  {isPending ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal / Diálogo para editar Vacuna */}
      {vacunaParaEditar && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-vacuna-title"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(16, 42, 49, 0.6)",
            display: "grid",
            placeItems: "center",
            padding: "16px",
            zIndex: 50,
          }}
        >
          <div
            className="sigsam-card"
            style={{
              maxWidth: "500px",
              width: "100%",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
          >
            <div className="sigsam-eyebrow">Vacunatorio</div>
            <h2 id="modal-vacuna-title" style={{ fontSize: "20px" }}>
              Editar arancel de vacuna
            </h2>
            <p className="sigsam-muted" style={{ marginTop: "4px" }}>
              Vacuna: <strong>{vacunaParaEditar.nombre}</strong>
            </p>

            {errorAccion && (
              <div
                className="sigsam-notice error"
                role="alert"
                style={{ marginTop: "16px" }}
              >
                <span className="sigsam-notice-symbol" aria-hidden="true">
                  !
                </span>
                <div>
                  <strong>Validación</strong>
                  <p style={{ margin: 0, fontSize: "13px" }}>{errorAccion}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleGuardarVacuna} style={{ marginTop: "16px" }}>
              <div className="sigsam-field">
                <label htmlFor="input-duracion-fija">Duración por turno</label>
                <input
                  id="input-duracion-fija"
                  type="text"
                  readOnly
                  disabled
                  value="15 minutos (fijo por protocolo)"
                  style={{ backgroundColor: "#f2f5f6", cursor: "not-allowed" }}
                />
                <span className="hint">
                  La duración del vacunatorio es fija por protocolo clínico.
                </span>
              </div>

              <div className="sigsam-field" style={{ marginTop: "12px" }}>
                <label htmlFor="input-arancel-vacuna">
                  Arancel particular (ARS)
                </label>
                <input
                  id="input-arancel-vacuna"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={inputArancelVacuna}
                  onChange={(e) => setInputArancelVacuna(e.target.value)}
                  placeholder="0.00"
                />
                <span className="hint">
                  Importe en pesos. Puede ser cero si la vacuna no tiene costo.
                </span>
              </div>

              <div
                className="sigsam-notice info"
                style={{ marginTop: "16px", marginBottom: "20px" }}
              >
                <span className="sigsam-notice-symbol" aria-hidden="true">
                  i
                </span>
                <p style={{ margin: 0, fontSize: "12px" }}>
                  Los umbrales de alerta de stock y registros de aplicación son
                  responsabilidad exclusiva de Enfermería.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={() => setVacunaParaEditar(null)}
                  className="sigsam-btn ghost"
                  disabled={isPending}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="sigsam-btn"
                  disabled={isPending}
                >
                  {isPending ? "Guardando..." : "Guardar arancel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
