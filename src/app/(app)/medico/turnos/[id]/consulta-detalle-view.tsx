import type { ConsultaClinicaViewData } from "@/lib/turnos/consulta-clinica";
import type { AdjuntoClinicoViewData } from "@/lib/turnos/adjuntos-clinicos";
import { AdjuntarDocumentoForm } from "./adjuntar-documento-form";

interface Props {
  consulta: ConsultaClinicaViewData;
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
  return (
    <div className="sigsam-card" style={{ marginTop: "16px" }}>
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

      <div
        style={{
          marginTop: "20px",
          paddingTop: "12px",
          borderTop: "1px solid var(--color-line, #d7e2e4)",
          fontSize: "12px",
          color: "var(--color-muted, #5f747a)",
        }}
      >
        <p style={{ margin: 0 }}>
          Registro clínico inmutable (CA4). Las correcciones o aclaraciones
          posteriores se incorporan mediante notas aditivas identificadas
          conservando el original.
        </p>
      </div>
    </div>
  );
}
