"use client";

import { etiquetaFecha } from "@/lib/agenda/reglas";
import type { VacunaAplicadaItem } from "@/lib/turnos/historial-clinico";

type Props = {
  vacunas: VacunaAplicadaItem[];
};

export function VacunasHistorialTable({ vacunas }: Props) {
  if (vacunas.length === 0) {
    return (
      <div className="sigsam-card">
        <div className="sigsam-notice info">
          <span className="sigsam-notice-symbol">i</span>
          <p style={{ margin: 0 }}>
            No hay vacunas aplicadas registradas para este paciente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="sigsam-card">
      <h2 style={{ marginTop: 0 }}>Vacunaciones registradas</h2>
      <div style={{ overflowX: "auto" }}>
        <table
          className="sigsam-table"
          style={{ width: "100%", borderCollapse: "collapse" }}
        >
          <thead>
            <tr
              style={{
                borderBottom: "2px solid var(--color-line, #cbd5e1)",
                textAlign: "left",
              }}
            >
              <th style={{ padding: "8px 12px" }}>Fecha de aplicación</th>
              <th style={{ padding: "8px 12px" }}>Vacuna</th>
              <th style={{ padding: "8px 12px" }}>Dosis / Lote</th>
              <th style={{ padding: "8px 12px" }}>Personal responsable</th>
            </tr>
          </thead>
          <tbody>
            {vacunas.map((item) => (
              <tr
                key={item.id}
                style={{
                  borderBottom: "1px solid var(--color-line, #e2e8f0)",
                }}
              >
                <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                  <strong>{etiquetaFecha(item.fecha)}</strong>
                  {item.hora && (
                    <span
                      className="sigsam-muted"
                      style={{ display: "block", fontSize: "12px" }}
                    >
                      {item.hora} hs
                    </span>
                  )}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <span className="sigsam-pill">{item.vacunaNombre}</span>
                </td>
                <td style={{ padding: "10px 12px" }}>{item.dosisOLote}</td>
                <td style={{ padding: "10px 12px" }}>
                  {item.responsableNombre}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
