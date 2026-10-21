"use client";

import { useState } from "react";
import { etiquetaFecha } from "@/lib/agenda/reglas";
import type { ConsultaHistorialItem } from "@/lib/turnos/historial-clinico";

function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatearFechaHora(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type Props = {
  consulta: ConsultaHistorialItem;
};

export function ConsultaHistorialCard({ consulta }: Props) {
  const [expandido, setExpandido] = useState(true);

  const tieneCamposAdicionales =
    Boolean(consulta.sintomas) ||
    Boolean(consulta.indicaciones) ||
    Boolean(consulta.medicacion) ||
    Boolean(consulta.estudios) ||
    Boolean(consulta.observaciones) ||
    Boolean(consulta.certificado);

  const tieneCorrecciones = consulta.correcciones.length > 0;
  const tieneAdjuntos = consulta.adjuntos.length > 0;

  return (
    <article
      className="sigsam-card"
      style={{
        marginBottom: 16,
        borderLeft: "4px solid var(--color-primary, #0f766e)",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
              {etiquetaFecha(consulta.fecha)} — {consulta.hora} hs
            </h3>
            <span className="sigsam-pill">{consulta.especialidadNombre}</span>
          </div>
          <p
            className="sigsam-muted"
            style={{ margin: "4px 0 0", fontSize: "14px" }}
          >
            <strong>Profesional:</strong> {consulta.medicoNombre}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setExpandido(!expandido)}
          className="sigsam-btn ghost small"
          aria-expanded={expandido}
        >
          {expandido ? "Ocultar detalle" : "Ver detalle completo"}
        </button>
      </header>

      {/* Diagnóstico (siempre visible, CA2 / CA3) */}
      <div
        style={{
          marginTop: 12,
          padding: "10px 12px",
          background: "var(--color-surface-subtle, #f8fafc)",
          borderRadius: "6px",
          border: "1px solid var(--color-line, #e2e8f0)",
        }}
      >
        <span
          style={{
            display: "block",
            fontSize: "12px",
            textTransform: "uppercase",
            fontWeight: 700,
            letterSpacing: "0.05em",
            color: "var(--color-primary, #0f766e)",
          }}
        >
          Diagnóstico
        </span>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--color-text, #0f172a)",
          }}
        >
          {consulta.diagnostico}
        </p>
      </div>

      {expandido && (
        <div style={{ marginTop: 16 }}>
          {/* Registro original de la atención (CA3) */}
          {tieneCamposAdicionales && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "12px",
                marginBottom: 16,
              }}
            >
              {consulta.sintomas && (
                <div>
                  <strong style={{ fontSize: "13px" }}>Síntomas:</strong>
                  <p style={{ margin: "2px 0 0", fontSize: "14px" }}>
                    {consulta.sintomas}
                  </p>
                </div>
              )}
              {consulta.indicaciones && (
                <div>
                  <strong style={{ fontSize: "13px" }}>Indicaciones:</strong>
                  <p style={{ margin: "2px 0 0", fontSize: "14px" }}>
                    {consulta.indicaciones}
                  </p>
                </div>
              )}
              {consulta.medicacion && (
                <div>
                  <strong style={{ fontSize: "13px" }}>Medicación:</strong>
                  <p style={{ margin: "2px 0 0", fontSize: "14px" }}>
                    {consulta.medicacion}
                  </p>
                </div>
              )}
              {consulta.estudios && (
                <div>
                  <strong style={{ fontSize: "13px" }}>
                    Estudios solicitados:
                  </strong>
                  <p style={{ margin: "2px 0 0", fontSize: "14px" }}>
                    {consulta.estudios}
                  </p>
                </div>
              )}
              {consulta.observaciones && (
                <div>
                  <strong style={{ fontSize: "13px" }}>Observaciones:</strong>
                  <p style={{ margin: "2px 0 0", fontSize: "14px" }}>
                    {consulta.observaciones}
                  </p>
                </div>
              )}
              {consulta.certificado && (
                <div>
                  <strong style={{ fontSize: "13px" }}>
                    Certificado emitido:
                  </strong>
                  <p style={{ margin: "2px 0 0", fontSize: "14px" }}>
                    {consulta.certificado}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Correcciones anexadas por el profesional (CA3) */}
          {tieneCorrecciones && (
            <div
              style={{
                marginTop: 16,
                padding: "12px",
                background: "#fefce8",
                border: "1px solid #fef08a",
                borderRadius: "6px",
              }}
            >
              <h4
                style={{
                  margin: "0 0 8px",
                  fontSize: "14px",
                  color: "#854d0e",
                  fontWeight: 600,
                }}
              >
                Correcciones anexadas ({consulta.correcciones.length})
              </h4>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {consulta.correcciones.map((corr) => (
                  <li
                    key={corr.id}
                    style={{
                      borderBottom: "1px solid #fef08a",
                      paddingBottom: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        fontSize: "12px",
                        color: "#a16207",
                      }}
                    >
                      <span>
                        Por {corr.autorNombre} · Motivo: <em>{corr.motivo}</em>
                      </span>
                      <span>{formatearFechaHora(corr.creadaEn)}</span>
                    </div>
                    <p
                      style={{
                        margin: "4px 0 0",
                        fontSize: "14px",
                        color: "#713f12",
                      }}
                    >
                      {corr.texto}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Documentación adjunta (CA3, CA5: visualización en línea sin descarga) */}
          <div style={{ marginTop: 16 }}>
            <h4 style={{ margin: "0 0 8px", fontSize: "14px" }}>
              Documentación adjunta ({consulta.adjuntos.length})
            </h4>
            {!tieneAdjuntos ? (
              <p
                className="sigsam-muted"
                style={{ margin: 0, fontSize: "13px" }}
              >
                Sin documentos adjuntos.
              </p>
            ) : (
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {consulta.adjuntos.map((adj) => (
                  <li
                    key={adj.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      padding: "8px 12px",
                      background: "var(--color-surface-subtle, #f8fafc)",
                      borderRadius: "6px",
                      border: "1px solid var(--color-line, #e2e8f0)",
                    }}
                  >
                    <div>
                      <strong>{adj.nombre}</strong>
                      <span
                        className="sigsam-muted"
                        style={{ marginLeft: "8px", fontSize: "12px" }}
                      >
                        {formatearTamano(adj.tamanoBytes)} · Incorporado el{" "}
                        {formatearFechaHora(adj.creadoEn)}
                      </span>
                    </div>
                    {/* CA5: Prohibido descargar; solo visualización en línea */}
                    <a
                      href={adj.urlVisualizacion}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sigsam-link"
                      style={{ fontSize: "13px", fontWeight: 600 }}
                    >
                      Ver archivo
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
