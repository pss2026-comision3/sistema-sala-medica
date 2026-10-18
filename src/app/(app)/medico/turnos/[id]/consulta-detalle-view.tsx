import type { ConsultaClinicaViewData } from "@/lib/turnos/consulta-clinica";

interface Props {
  consulta: ConsultaClinicaViewData;
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

export function ConsultaDetalleView({ consulta }: Props) {
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
