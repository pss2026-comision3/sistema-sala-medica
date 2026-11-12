"use client";

import type {
  DetalleCitaReporte,
  ResultadoReporteAsistencia,
} from "@/lib/reportes/tipos";

interface Props {
  resultado: ResultadoReporteAsistencia;
}

export function VistaAsistenciaReporte({ resultado }: Props) {
  const { asistencia, recordatorios, citas, periodo } = resultado;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "28px",
        marginTop: "24px",
      }}
    >
      {/* 1. Resumen de Asistencia y Ausentismo (CA2 y CA3) */}
      <section className="sigsam-card">
        <div style={{ marginBottom: "18px" }}>
          <h2
            style={{ fontSize: "19px", fontWeight: "700", margin: "0 0 4px" }}
          >
            Resumen de Resultados de Atención
          </h2>
          <p className="sigsam-muted" style={{ fontSize: "14px", margin: 0 }}>
            Período evaluado: {periodo.desde} al {periodo.hasta} (turnos con
            horario finalizado)
          </p>
        </div>

        {/* Grilla de Tarjetas KPI */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          {/* Tasa de Asistencia (CA3) */}
          <div
            style={{
              padding: "16px",
              borderRadius: "8px",
              backgroundColor: "#f0f7f7",
              border: "1px solid #cce4e3",
            }}
          >
            <div className="sigsam-eyebrow" style={{ color: "#0d5c58" }}>
              Tasa de Asistencia
            </div>
            <div
              style={{
                fontSize: "28px",
                fontWeight: "800",
                color: "#0d5c58",
                margin: "4px 0",
              }}
            >
              {asistencia.porcentajeAsistencia}
            </div>
            <div className="sigsam-muted" style={{ fontSize: "12px" }}>
              Atendidos / (Atendidos + Ausentes)
            </div>
          </div>

          {/* Atendidos */}
          <div
            style={{
              padding: "16px",
              borderRadius: "8px",
              backgroundColor: "#f4faf6",
              border: "1px solid #c3e6cb",
            }}
          >
            <div className="sigsam-eyebrow" style={{ color: "#1e7e34" }}>
              Atendidos
            </div>
            <div
              style={{
                fontSize: "28px",
                fontWeight: "800",
                color: "#1e7e34",
                margin: "4px 0",
              }}
            >
              {asistencia.atendidos}
            </div>
            <div className="sigsam-muted" style={{ fontSize: "12px" }}>
              Atención médica completada
            </div>
          </div>

          {/* Ausentes */}
          <div
            style={{
              padding: "16px",
              borderRadius: "8px",
              backgroundColor: "#fdf4f4",
              border: "1px solid #f5c6cb",
            }}
          >
            <div className="sigsam-eyebrow" style={{ color: "#bd2130" }}>
              Ausentes
            </div>
            <div
              style={{
                fontSize: "28px",
                fontWeight: "800",
                color: "#bd2130",
                margin: "4px 0",
              }}
            >
              {asistencia.ausentes}
            </div>
            <div className="sigsam-muted" style={{ fontSize: "12px" }}>
              Inasistencias registradas
            </div>
          </div>

          {/* Sin Registrar */}
          <div
            style={{
              padding: "16px",
              borderRadius: "8px",
              backgroundColor:
                asistencia.sinRegistrar > 0 ? "#fffbf0" : "#fafafa",
              border:
                asistencia.sinRegistrar > 0
                  ? "1px solid #ffeeba"
                  : "1px solid #e0e0e0",
            }}
          >
            <div
              className="sigsam-eyebrow"
              style={{
                color:
                  asistencia.sinRegistrar > 0
                    ? "#856404"
                    : "var(--color-muted)",
              }}
            >
              Sin Registrar
            </div>
            <div
              style={{
                fontSize: "28px",
                fontWeight: "800",
                color:
                  asistencia.sinRegistrar > 0 ? "#856404" : "var(--color-ink)",
                margin: "4px 0",
              }}
            >
              {asistencia.sinRegistrar}
            </div>
            <div className="sigsam-muted" style={{ fontSize: "12px" }}>
              Citas pasadas sin resultado
            </div>
          </div>
        </div>

        {/* Información complementaria de turnos cancelados y futuros (CA1) */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "24px",
            fontSize: "13px",
            padding: "12px 16px",
            backgroundColor: "#fafafa",
            borderRadius: "6px",
            border: "1px solid var(--color-line)",
          }}
        >
          <div>
            <strong style={{ color: "var(--color-ink)" }}>
              Turnos cancelados en el período:
            </strong>{" "}
            <span style={{ fontWeight: "700" }}>{asistencia.cancelados}</span>
          </div>
          {asistencia.futurosExcluidos > 0 && (
            <div style={{ color: "var(--color-muted)" }}>
              <span>
                ℹ️ <strong>{asistencia.futurosExcluidos}</strong> turnos con
                horario futuro en el período fueron excluidos del cálculo de
                ausentismo (CA1).
              </span>
            </div>
          )}
        </div>
      </section>

      {/* 2. Auditoría de Recordatorios (CA4) */}
      <section className="sigsam-card">
        <div style={{ marginBottom: "18px" }}>
          <h2
            style={{ fontSize: "19px", fontWeight: "700", margin: "0 0 4px" }}
          >
            Auditoría de Recordatorios
          </h2>
          <p className="sigsam-muted" style={{ fontSize: "14px", margin: 0 }}>
            Revisión operativa de las notificaciones automáticas (24 hs antes de
            la cita)
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginBottom: "16px",
          }}
        >
          {/* Recordatorios enviados */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "8px",
              backgroundColor: "#f4faf6",
              border: "1px solid #c3e6cb",
            }}
          >
            <div className="sigsam-eyebrow" style={{ color: "#1e7e34" }}>
              Recordatorio Enviado
            </div>
            <div
              style={{
                fontSize: "24px",
                fontWeight: "800",
                color: "#1e7e34",
                margin: "2px 0",
              }}
            >
              {recordatorios.enviados}
            </div>
            <div className="sigsam-muted" style={{ fontSize: "12px" }}>
              Entrega al servidor de correo confirmada
            </div>
          </div>

          {/* Recordatorios fallidos */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "8px",
              backgroundColor: "#fdf4f4",
              border: "1px solid #f5c6cb",
            }}
          >
            <div className="sigsam-eyebrow" style={{ color: "#bd2130" }}>
              Recordatorio Fallido
            </div>
            <div
              style={{
                fontSize: "24px",
                fontWeight: "800",
                color: "#bd2130",
                margin: "2px 0",
              }}
            >
              {recordatorios.fallidos}
            </div>
            <div className="sigsam-muted" style={{ fontSize: "12px" }}>
              Fallo de envío tras reintentos
            </div>
          </div>

          {/* Reserva tardía */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "8px",
              backgroundColor: "#f5f7f8",
              border: "1px solid #dfe3e6",
            }}
          >
            <div className="sigsam-eyebrow" style={{ color: "#495057" }}>
              Reserva Tardía (&lt; 24 hs)
            </div>
            <div
              style={{
                fontSize: "24px",
                fontWeight: "800",
                color: "#495057",
                margin: "2px 0",
              }}
            >
              {recordatorios.reservaTardia}
            </div>
            <div className="sigsam-muted" style={{ fontSize: "12px" }}>
              No correspondió por ventana de 24 hs
            </div>
          </div>
        </div>

        {/* Leyenda aclaratoria obligatoria (CA4 e inferencias) */}
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "#f8f9fa",
            borderRadius: "6px",
            borderLeft: "4px solid #17a2b8",
            fontSize: "13px",
            color: "#333",
            lineHeight: "1.5",
          }}
        >
          <strong>Aclaración metodológica (CA4):</strong> La cuantificación de
          recordatorios es de carácter técnico y descriptivo. El envío del
          correo electrónico constata la entrega al servidor SMTP y no acredita
          lectura fehaciente por parte del paciente ni permite atribuir
          causalidad sobre su asistencia o inasistencia.
        </div>
      </section>

      {/* 3. Tabla Detalle de Citas Evaluadas */}
      <section className="sigsam-card">
        <div style={{ marginBottom: "16px" }}>
          <h2
            style={{ fontSize: "19px", fontWeight: "700", margin: "0 0 4px" }}
          >
            Detalle de Citas del Período ({citas.length})
          </h2>
          <p className="sigsam-muted" style={{ fontSize: "14px", margin: 0 }}>
            Listado discriminado de turnos con sus resultados y estados de
            notificación
          </p>
        </div>

        {citas.length === 0 ? (
          <div className="sigsam-empty">
            <p>
              No se encontraron citas en el período y filtros seleccionados.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "14px",
                textAlign: "left",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "2px solid var(--color-line)",
                    backgroundColor: "#f8fbfb",
                  }}
                >
                  <th style={{ padding: "10px 14px", fontWeight: "700" }}>
                    Fecha
                  </th>
                  <th style={{ padding: "10px 14px", fontWeight: "700" }}>
                    Hora
                  </th>
                  <th style={{ padding: "10px 14px", fontWeight: "700" }}>
                    Paciente
                  </th>
                  <th style={{ padding: "10px 14px", fontWeight: "700" }}>
                    Médico
                  </th>
                  <th style={{ padding: "10px 14px", fontWeight: "700" }}>
                    Especialidad
                  </th>
                  <th style={{ padding: "10px 14px", fontWeight: "700" }}>
                    Estado Cita
                  </th>
                  <th style={{ padding: "10px 14px", fontWeight: "700" }}>
                    Resultado
                  </th>
                  <th style={{ padding: "10px 14px", fontWeight: "700" }}>
                    Recordatorio
                  </th>
                </tr>
              </thead>
              <tbody>
                {citas.map((cita) => (
                  <tr
                    key={cita.id}
                    style={{
                      borderBottom: "1px solid var(--color-line)",
                      opacity: cita.estado === "CANCELADO" ? 0.7 : 1,
                    }}
                  >
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      {cita.fecha}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontWeight: "600",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cita.hora} hs
                    </td>
                    <td style={{ padding: "10px 14px" }}>{cita.paciente}</td>
                    <td style={{ padding: "10px 14px" }}>{cita.medico}</td>
                    <td style={{ padding: "10px 14px" }}>
                      {cita.especialidad}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <EstadoTurnoBadge estado={cita.estado} />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <ResultadoBadge
                        resultado={cita.resultado}
                        horarioTerminado={cita.horarioTerminado}
                      />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <RecordatorioBadge estado={cita.estadoRecordatorio} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function EstadoTurnoBadge({ estado }: { estado: string }) {
  if (estado === "CANCELADO") {
    return (
      <span
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: "12px",
          backgroundColor: "#f8d7da",
          color: "#721c24",
          fontSize: "12px",
          fontWeight: "600",
        }}
      >
        Cancelado
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "12px",
        backgroundColor: "#e2e3e5",
        color: "#383d41",
        fontSize: "12px",
        fontWeight: "600",
      }}
    >
      Confirmado
    </span>
  );
}

function ResultadoBadge({
  resultado,
  horarioTerminado,
}: {
  resultado: string;
  horarioTerminado: boolean;
}) {
  if (!horarioTerminado) {
    return (
      <span
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: "12px",
          backgroundColor: "#e9ecef",
          color: "#6c757d",
          fontSize: "12px",
          fontWeight: "600",
        }}
      >
        Horario futuro
      </span>
    );
  }

  if (resultado === "ATENDIDO") {
    return (
      <span
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: "12px",
          backgroundColor: "#d4edda",
          color: "#155724",
          fontSize: "12px",
          fontWeight: "600",
        }}
      >
        Atendido
      </span>
    );
  }

  if (resultado === "AUSENTE") {
    return (
      <span
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: "12px",
          backgroundColor: "#f8d7da",
          color: "#721c24",
          fontSize: "12px",
          fontWeight: "600",
        }}
      >
        Ausente
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "12px",
        backgroundColor: "#fff3cd",
        color: "#856404",
        fontSize: "12px",
        fontWeight: "600",
      }}
    >
      Sin registrar
    </span>
  );
}

function RecordatorioBadge({
  estado,
}: {
  estado: DetalleCitaReporte["estadoRecordatorio"];
}) {
  switch (estado) {
    case "ENVIADO":
      return (
        <span
          style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: "12px",
            backgroundColor: "#d1ecf1",
            color: "#0c5460",
            fontSize: "12px",
            fontWeight: "600",
          }}
        >
          Enviado
        </span>
      );
    case "FALLIDO":
      return (
        <span
          style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: "12px",
            backgroundColor: "#f8d7da",
            color: "#721c24",
            fontSize: "12px",
            fontWeight: "600",
          }}
        >
          Fallido
        </span>
      );
    case "RESERVA_TARDIA":
      return (
        <span
          style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: "12px",
            backgroundColor: "#e2e3e5",
            color: "#383d41",
            fontSize: "12px",
            fontWeight: "600",
          }}
        >
          Tardía (&lt;24h)
        </span>
      );
    case "SIN_RECORDATORIO":
    default:
      return (
        <span
          style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: "12px",
            backgroundColor: "#f8f9fa",
            color: "#6c757d",
            fontSize: "12px",
            fontWeight: "500",
          }}
        >
          Sin recordatorio
        </span>
      );
  }
}
