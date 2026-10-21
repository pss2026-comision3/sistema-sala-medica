"use client";

import { useState } from "react";
import type { EspecialidadFiltroItem } from "@/lib/turnos/historial-clinico";

type Props = {
  desdeInicial?: string;
  hastaInicial?: string;
  especialidadInicial?: string;
  especialidades: EspecialidadFiltroItem[];
  onAplicar: (filtros: {
    desde?: string;
    hasta?: string;
    especialidadId?: string;
  }) => void;
  onLimpiar: () => void;
};

export function FiltrosHistorialBar({
  desdeInicial = "",
  hastaInicial = "",
  especialidadInicial = "",
  especialidades,
  onAplicar,
  onLimpiar,
}: Props) {
  const [desde, setDesde] = useState(desdeInicial);
  const [hasta, setHasta] = useState(hastaInicial);
  const [especialidadId, setEspecialidadId] = useState(especialidadInicial);
  const [errorRango, setErrorRango] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (desde && hasta && desde > hasta) {
      setErrorRango(
        "La fecha «Desde» no puede ser posterior a la fecha «Hasta».",
      );
      return;
    }

    setErrorRango(null);
    onAplicar({
      desde: desde || undefined,
      hasta: hasta || undefined,
      especialidadId: especialidadId || undefined,
    });
  };

  const handleLimpiar = () => {
    setDesde("");
    setHasta("");
    setEspecialidadId("");
    setErrorRango(null);
    onLimpiar();
  };

  const tieneFiltrosActivos = !!desde || !!hasta || !!especialidadId;

  return (
    <div className="sigsam-card" style={{ marginBottom: 16 }}>
      <h2 style={{ marginTop: 0 }}>Filtros de búsqueda</h2>
      <form onSubmit={handleSubmit}>
        <div className="sigsam-grid cols-3" style={{ gap: "12px" }}>
          <div className="sigsam-field">
            <label htmlFor="filtro-desde">Desde</label>
            <input
              id="filtro-desde"
              type="date"
              value={desde}
              onChange={(e) => {
                setDesde(e.target.value);
                if (errorRango) setErrorRango(null);
              }}
            />
          </div>

          <div className="sigsam-field">
            <label htmlFor="filtro-hasta">Hasta</label>
            <input
              id="filtro-hasta"
              type="date"
              value={hasta}
              onChange={(e) => {
                setHasta(e.target.value);
                if (errorRango) setErrorRango(null);
              }}
            />
          </div>

          <div className="sigsam-field">
            <label htmlFor="filtro-especialidad">Especialidad</label>
            <select
              id="filtro-especialidad"
              value={especialidadId}
              onChange={(e) => setEspecialidadId(e.target.value)}
            >
              <option value="">Todas las especialidades</option>
              {especialidades.map((esp) => (
                <option key={esp.id} value={esp.id}>
                  {esp.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {errorRango && (
          <div
            className="sigsam-notice error"
            role="alert"
            style={{ marginTop: 12 }}
          >
            <span className="sigsam-notice-symbol">!</span>
            <p style={{ margin: 0 }}>{errorRango}</p>
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: "8px",
            marginTop: 16,
            alignItems: "center",
          }}
        >
          <button type="submit" className="sigsam-btn secondary">
            Aplicar filtros
          </button>
          {tieneFiltrosActivos && (
            <button
              type="button"
              onClick={handleLimpiar}
              className="sigsam-btn ghost"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
