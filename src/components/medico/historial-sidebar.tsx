"use client";

import { useState } from "react";
import Link from "next/link";

type ResumenConsulta = {
  turnoId: string;
  creadaEn: string;
  pacienteNombre: string;
  pacienteDni: string;
};

interface Props {
  historial: ResumenConsulta[];
  turnoSeleccionadoId?: string;
}

export function HistorialSidebar({ historial, turnoSeleccionadoId }: Props) {
  const [busqueda, setBusqueda] = useState("");

  const historialFiltrado = historial.filter((item) => {
    const term = busqueda.toLowerCase();
    const fechaFormateada = new Date(item.creadaEn).toLocaleDateString("es-AR");

    return (
      item.pacienteNombre.toLowerCase().includes(term) ||
      item.pacienteDni.includes(term) ||
      fechaFormateada.includes(term)
    );
  });

  return (
    <div
      className="sigsam-card"
      style={{
        flex: "0 0 320px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        maxHeight: "calc(100vh - 200px)",
      }}
    >
      <h2 style={{ fontSize: "16px", marginBottom: "12px" }}>
        Tus Consultas ({historial.length})
      </h2>

      <div className="sigsam-field" style={{ marginBottom: "16px" }}>
        <input
          type="text"
          placeholder="Buscar por nombre, DNI o fecha..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ width: "100%", padding: "8px", fontSize: "14px" }}
        />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          overflowY: "auto",
          paddingRight: "4px",
        }}
      >
        {historialFiltrado.length === 0 ? (
          <p
            className="sigsam-muted"
            style={{ fontSize: "14px", textAlign: "center", marginTop: "20px" }}
          >
            No se encontraron consultas para "{busqueda}".
          </p>
        ) : (
          historialFiltrado.map((item) => {
            const seleccionado = item.turnoId === turnoSeleccionadoId;

            return (
              <Link
                key={item.turnoId}
                href={`/medico/correcciones?turnoId=${item.turnoId}`}
                style={{
                  display: "block",
                  padding: "12px",
                  borderRadius: "6px",
                  textDecoration: "none",
                  border: "1px solid",
                  borderColor: seleccionado
                    ? "#1b6338"
                    : "var(--color-line, #d7e2e4)",
                  backgroundColor: seleccionado ? "#edf7f1" : "transparent",
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    color: "var(--color-ink, #18323a)",
                    fontSize: "14px",
                  }}
                >
                  {item.pacienteNombre}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--color-muted, #5f747a)",
                    marginTop: "4px",
                  }}
                >
                  DNI: {item.pacienteDni}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--color-muted, #5f747a)",
                    marginTop: "2px",
                  }}
                >
                  {new Date(item.creadaEn).toLocaleDateString("es-AR")}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
