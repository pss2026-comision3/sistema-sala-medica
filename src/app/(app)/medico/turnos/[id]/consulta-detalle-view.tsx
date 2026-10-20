"use client";

import { useState, useActionState } from "react";
import { agregarCorreccion } from "@/app/actions/consultas";
import type { ConsultaClinicaViewData } from "@/lib/turnos/consulta-clinica";
import type { AdjuntoClinicoViewData } from "@/lib/turnos/adjuntos-clinicos";
import { AdjuntarDocumentoForm } from "./adjuntar-documento-form";

export type CorreccionView = {
  id: string;
  motivo: string;
  texto: string;
  creadaEn: string;
  autorNombre: string;
};

interface Props {
  consulta: ConsultaClinicaViewData & {
    esAutor?: boolean;
    correcciones?: CorreccionView[];
  };
  adjuntos?: AdjuntoClinicoViewData[];
  turnoId: string;
}

function formatearFechaHora(iso: string): string {
  try {
    const fecha = new Date(iso);
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(fecha);
  } catch {
    return iso;
  }
}

function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatearFecha(iso: string): string {
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

export function ConsultaDetalleView({
  consulta,
  adjuntos = [],
  turnoId,
}: Props) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [stateCorreccion, actionCorreccion, isPending] = useActionState(
    agregarCorreccion,
    { success: false },
  );

  function handleCerrarModal() {
    setModalAbierto(false);
    if (stateCorreccion.success) {
      window.location.reload();
    }
  }

  return (
    <div className="sigsam-card" style={{ marginTop: "16px" }}>
      {/* --- CONSULTA ORIGINAL --- */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "8px",
          borderBottom: "1px solid var(--color-line, #d7e2e4)",
          paddingBottom: "12px",
          marginBottom: "16px",
        }}
      >
        <div>
          <h2>Consulta clínica registrada</h2>
          <p
            className="sigsam-muted"
            style={{ margin: "4px 0 0", fontSize: "14px" }}
          >
            Atención realizada por <strong>{consulta.autorNombre}</strong> el{" "}
            {formatearFechaHora(consulta.creadaEn)} hs
          </p>
        </div>
        <span
          className="sigsam-badge success"
          style={{
            padding: "4px 10px",
            borderRadius: "9999px",
            fontSize: "12px",
            fontWeight: 600,
            backgroundColor: "#e6f4ea",
            color: "#137333",
          }}
        >
          Atendido
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <h3
            style={{
              fontSize: "14px",
              fontWeight: 700,
              margin: "0 0 4px",
              color: "var(--color-ink, #18323a)",
            }}
          >
            Diagnóstico
          </h3>
          <p
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              fontSize: "15px",
              lineHeight: "1.5",
            }}
          >
            {consulta.diagnostico}
          </p>
        </div>

        {consulta.sintomas && (
          <div>
            <h3
              style={{
                fontSize: "14px",
                fontWeight: 700,
                margin: "0 0 4px",
                color: "var(--color-muted, #5f747a)",
              }}
            >
              Síntomas referidos
            </h3>
            <p
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                fontSize: "14px",
                lineHeight: "1.5",
              }}
            >
              {consulta.sintomas}
            </p>
          </div>
        )}

        {consulta.indicaciones && (
          <div>
            <h3
              style={{
                fontSize: "14px",
                fontWeight: 700,
                margin: "0 0 4px",
                color: "var(--color-muted, #5f747a)",
              }}
            >
              Indicaciones y pautas
            </h3>
            <p
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                fontSize: "14px",
                lineHeight: "1.5",
              }}
            >
              {consulta.indicaciones}
            </p>
          </div>
        )}

        {consulta.medicacion && (
          <div>
            <h3
              style={{
                fontSize: "14px",
                fontWeight: 700,
                margin: "0 0 4px",
                color: "var(--color-muted, #5f747a)",
              }}
            >
              Medicación recetada
            </h3>
            <p
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                fontSize: "14px",
                lineHeight: "1.5",
              }}
            >
              {consulta.medicacion}
            </p>
          </div>
        )}

        {consulta.estudios && (
          <div>
            <h3
              style={{
                fontSize: "14px",
                fontWeight: 700,
                margin: "0 0 4px",
                color: "var(--color-muted, #5f747a)",
              }}
            >
              Estudios solicitados
            </h3>
            <p
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                fontSize: "14px",
                lineHeight: "1.5",
              }}
            >
              {consulta.estudios}
            </p>
          </div>
        )}

        {consulta.observaciones && (
          <div>
            <h3
              style={{
                fontSize: "14px",
                fontWeight: 700,
                margin: "0 0 4px",
                color: "var(--color-muted, #5f747a)",
              }}
            >
              Observaciones
            </h3>
            <p
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                fontSize: "14px",
                lineHeight: "1.5",
              }}
            >
              {consulta.observaciones}
            </p>
          </div>
        )}

        {consulta.certificado && (
          <div>
            <h3
              style={{
                fontSize: "14px",
                fontWeight: 700,
                margin: "0 0 4px",
                color: "var(--color-muted, #5f747a)",
              }}
            >
              Certificado médico
            </h3>
            <p
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                fontSize: "14px",
                lineHeight: "1.5",
              }}
            >
              {consulta.certificado}
            </p>
          </div>
        )}
      </div>

      {/* --- DOCUMENTACIÓN ADJUNTA (Del archivo actual) --- */}
      <section style={{ marginTop: "20px" }}>
        <h2>Documentación adjunta</h2>
        {adjuntos.length === 0 ? (
          <p className="sigsam-muted" style={{ fontSize: "14px" }}>
            Esta consulta no tiene documentos adjuntos.
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: "8px 0 16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {adjuntos.map((adjunto) => (
              <li
                key={adjunto.id}
                style={{
                  border: "1px solid var(--color-line, #d7e2e4)",
                  borderRadius: "6px",
                  padding: "10px 12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <strong style={{ fontSize: "14px" }}>{adjunto.nombre}</strong>
                  <span className="sigsam-muted" style={{ fontSize: "12px" }}>
                    {formatearTamano(adjunto.tamanoBytes)} · Adjuntado el{" "}
                    {formatearFecha(adjunto.creadoEn)}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: "8px",
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <a
                    href={`/api/medico/consultas/${turnoId}/adjuntos/${adjunto.id}/archivo`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sigsam-link"
                  >
                    Ver archivo
                  </a>
                  <a
                    href={`/api/medico/consultas/${turnoId}/adjuntos/${adjunto.id}/archivo?download=1`}
                    className="sigsam-link"
                  >
                    Descargar
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
        <AdjuntarDocumentoForm turnoId={turnoId} />
      </section>

      {/* --- SECCIÓN DE CORRECCIONES (TIMELINE NUESTRO) --- */}
      {consulta.correcciones && consulta.correcciones.length > 0 && (
        <div
          style={{
            marginTop: "24px",
            paddingTop: "20px",
            borderTop: "2px dashed var(--color-line, #d7e2e4)",
          }}
        >
          <h3
            style={{
              fontSize: "16px",
              marginBottom: "16px",
              color: "var(--color-ink)",
            }}
          >
            Historial de Correcciones
          </h3>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              borderLeft: "2px solid #bfddcb",
              paddingLeft: "20px",
              marginLeft: "8px",
            }}
          >
            {consulta.correcciones.map((corr) => (
              <div key={corr.id} style={{ position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: "-27px",
                    top: "4px",
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    backgroundColor: "#1b6338",
                    border: "2px solid #fff",
                  }}
                />
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--color-muted, #5f747a)",
                    marginBottom: "4px",
                  }}
                >
                  <strong>{corr.autorNombre}</strong> anexó una aclaración el{" "}
                  {formatearFechaHora(corr.creadaEn)} hs
                </div>
                <div
                  style={{
                    backgroundColor: "#f9fafa",
                    border: "1px solid #e1e8ea",
                    borderRadius: "6px",
                    padding: "12px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#144929",
                      marginBottom: "6px",
                    }}
                  >
                    Motivo: {corr.motivo}
                  </div>
                  <p
                    style={{
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      fontSize: "14px",
                      lineHeight: "1.5",
                    }}
                  >
                    {corr.texto}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- FOOTER Y BOTÓN DE ACCIÓN --- */}
      <div
        style={{
          marginTop: "24px",
          paddingTop: "16px",
          borderTop: "1px solid var(--color-line, #d7e2e4)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "12px",
            color: "var(--color-muted, #5f747a)",
            maxWidth: "60%",
          }}
        >
          Registro clínico inmutable (CA4). Las aclaraciones posteriores se
          incorporan mediante notas aditivas conservando el original.
        </p>

        {consulta.esAutor && (
          <button
            type="button"
            onClick={() => setModalAbierto(true)}
            className="sigsam-btn secondary small"
          >
            Agregar aclaración
          </button>
        )}
      </div>

      {/* --- MODAL DE FORMULARIO --- */}
      {modalAbierto && (
        <div
          role="dialog"
          aria-modal="true"
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
              maxWidth: "520px",
              width: "100%",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
          >
            {stateCorreccion.success ? (
              <>
                <div
                  className="sigsam-eyebrow"
                  style={{ color: "#1b6338", marginBottom: "8px" }}
                >
                  Operación exitosa
                </div>
                <h2 style={{ fontSize: "20px", marginBottom: "16px" }}>
                  Aclaración agregada
                </h2>
                <div
                  className="sigsam-notice success"
                  style={{ marginBottom: "20px" }}
                >
                  <span className="sigsam-notice-symbol" aria-hidden="true">
                    ✓
                  </span>
                  <div>
                    <p style={{ margin: 0 }}>
                      La corrección se anexó correctamente al historial clínico
                      de esta consulta.
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={handleCerrarModal}
                    className="sigsam-btn"
                  >
                    Aceptar y cerrar
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="sigsam-eyebrow">Anotación Aditiva</div>
                <h2 style={{ fontSize: "20px" }}>Agregar aclaración</h2>
                <p
                  className="sigsam-muted"
                  style={{ marginTop: "8px", marginBottom: "20px" }}
                >
                  Esta corrección se anexará al final del historial conservando
                  el texto original intacto.
                </p>

                {!stateCorreccion.success && stateCorreccion.message && (
                  <div
                    className="sigsam-notice error"
                    style={{ marginBottom: "16px" }}
                  >
                    <span className="sigsam-notice-symbol" aria-hidden="true">
                      !
                    </span>
                    <div>
                      <p style={{ margin: 0 }}>{stateCorreccion.message}</p>
                    </div>
                  </div>
                )}

                <form action={actionCorreccion}>
                  <input type="hidden" name="turnoId" value={turnoId} />

                  <div
                    className="sigsam-field"
                    style={{ marginBottom: "16px" }}
                  >
                    <label htmlFor="motivo">Motivo de la corrección *</label>
                    <input
                      type="text"
                      id="motivo"
                      name="motivo"
                      required
                      placeholder="Ej. Omisión de antecedente, Ajuste de dosis..."
                      aria-invalid={!!stateCorreccion.errors?.motivo}
                    />
                    {stateCorreccion.errors?.motivo && (
                      <span
                        className="sigsam-alert-error"
                        style={{
                          color: "#b4393a",
                          fontSize: "13px",
                          fontWeight: "700",
                          display: "block",
                          marginTop: "4px",
                        }}
                      >
                        {stateCorreccion.errors.motivo[0]}
                      </span>
                    )}
                  </div>

                  <div
                    className="sigsam-field"
                    style={{ marginBottom: "24px" }}
                  >
                    <label htmlFor="texto">Texto de la aclaración *</label>
                    <textarea
                      id="texto"
                      name="texto"
                      required
                      rows={5}
                      placeholder="Escribí acá el contenido que deseás anexar a la consulta..."
                      aria-invalid={!!stateCorreccion.errors?.texto}
                      style={{ resize: "vertical" }}
                    />
                    {stateCorreccion.errors?.texto && (
                      <span
                        className="sigsam-alert-error"
                        style={{
                          color: "#b4393a",
                          fontSize: "13px",
                          fontWeight: "700",
                          display: "block",
                          marginTop: "4px",
                        }}
                      >
                        {stateCorreccion.errors.texto[0]}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: "12px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={handleCerrarModal}
                      className="sigsam-btn-ghost"
                      disabled={isPending}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="sigsam-btn"
                      disabled={isPending}
                    >
                      {isPending ? "Guardando..." : "Guardar aclaración"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
