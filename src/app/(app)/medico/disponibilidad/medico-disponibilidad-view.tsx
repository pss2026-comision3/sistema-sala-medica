"use client";

import { useState, useTransition } from "react";
import { publicarDisponibilidadMensual, type DiaConfiguracion } from "@/app/actions/disponibilidad";

const DIAS_SEMANA = [
  { valor: 1, label: "Lunes" },
  { valor: 2, label: "Martes" },
  { valor: 3, label: "Miércoles" },
  { valor: 4, label: "Jueves" },
  { valor: 5, label: "Viernes" },
  { valor: 6, label: "Sábado" },
];

export function MedicoDisponibilidadView() {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  
  // Iniciamos con 1 día por defecto
  const [dias, setDias] = useState<DiaConfiguracion[]>([
    { diaSemana: 1, horaDesde: "08:00", horaHasta: "12:00" },
  ]);

  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAgregarDia = () => {
    if (dias.length >= 2) return;
    setDias([...dias, { diaSemana: 2, horaDesde: "08:00", horaHasta: "12:00" }]);
  };

  const handleRemoverDia = (index: number) => {
    setDias(dias.filter((_, i) => i !== index));
  };

  const handleChangeDia = (index: number, campo: keyof DiaConfiguracion, valor: string | number) => {
    const nuevosDias = [...dias];
    nuevosDias[index] = { ...nuevosDias[index], [campo]: valor };
    setDias(nuevosDias);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorAccion(null);
    setMensajeExito(null);

    // Validación básica en cliente
    const diasUnicos = new Set(dias.map(d => d.diaSemana));
    if (diasUnicos.size !== dias.length) {
      setErrorAccion("No podés seleccionar el mismo día de la semana dos veces.");
      return;
    }

    startTransition(async () => {
      const res = await publicarDisponibilidadMensual({ mes, anio, dias });
      if (res.error) {
        setErrorAccion(res.error);
      } else {
        setMensajeExito(res.mensaje ?? "Disponibilidad publicada correctamente.");
        // Opcional: limpiar formulario después del éxito
      }
    });
  };

  return (
    <div style={{ maxWidth: "800px" }}>
      {mensajeExito && (
        <div className="sigsam-notice success" role="status" style={{ marginBottom: "20px" }}>
          <span className="sigsam-notice-symbol" aria-hidden="true">✓</span>
          <div>
            <strong>Operación exitosa</strong>
            <p style={{ margin: 0, fontSize: "14px" }}>{mensajeExito}</p>
          </div>
        </div>
      )}

      {errorAccion && (
        <div className="sigsam-notice error" role="alert" style={{ marginBottom: "20px" }}>
          <span className="sigsam-notice-symbol" aria-hidden="true">!</span>
          <div>
            <strong>Error</strong>
            <p style={{ margin: 0, fontSize: "14px" }}>{errorAccion}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="sigsam-card">
        <div className="sigsam-eyebrow">Configuración mensual</div>
        <h2 style={{ fontSize: "20px", marginBottom: "16px" }}>Publicar agenda</h2>

        <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
          <div className="sigsam-field" style={{ flex: 1 }}>
            <label htmlFor="mes">Mes</label>
            <select id="mes" value={mes} onChange={(e) => setMes(Number(e.target.value))} required>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(0, m - 1).toLocaleString('es-AR', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <div className="sigsam-field" style={{ flex: 1 }}>
            <label htmlFor="anio">Año</label>
            <input 
              id="anio" 
              type="number" 
              value={anio} 
              onChange={(e) => setAnio(Number(e.target.value))} 
              min={hoy.getFullYear()} 
              required 
            />
          </div>
        </div>

        <hr style={{ border: "0", borderTop: "1px solid var(--color-line, #d7e2e4)", margin: "24px 0" }} />

        <h3 style={{ fontSize: "16px", marginBottom: "12px" }}>Días de atención (Máximo 2)</h3>
        
        {dias.map((dia, index) => (
          <div key={index} style={{ display: "flex", gap: "12px", alignItems: "flex-end", marginBottom: "16px" }}>
            <div className="sigsam-field" style={{ flex: 2 }}>
              <label>Día de la semana</label>
              <select 
                value={dia.diaSemana} 
                onChange={(e) => handleChangeDia(index, "diaSemana", Number(e.target.value))}
                required
              >
                {DIAS_SEMANA.map(ds => (
                  <option key={ds.valor} value={ds.valor}>{ds.label}</option>
                ))}
              </select>
            </div>
            <div className="sigsam-field" style={{ flex: 1 }}>
              <label>Desde</label>
              <input 
                type="time" 
                value={dia.horaDesde} 
                onChange={(e) => handleChangeDia(index, "horaDesde", e.target.value)}
                required
              />
            </div>
            <div className="sigsam-field" style={{ flex: 1 }}>
              <label>Hasta</label>
              <input 
                type="time" 
                value={dia.horaHasta} 
                onChange={(e) => handleChangeDia(index, "horaHasta", e.target.value)}
                required
              />
            </div>
            {dias.length > 1 && (
              <button 
                type="button" 
                onClick={() => handleRemoverDia(index)}
                className="sigsam-btn ghost small"
                style={{ marginBottom: "8px", color: "#d93a3a" }}
              >
                Quitar
              </button>
            )}
          </div>
        ))}

        {dias.length < 2 && (
          <button 
            type="button" 
            onClick={handleAgregarDia}
            className="sigsam-btn secondary small"
            style={{ marginBottom: "24px" }}
          >
            + Agregar segundo día
          </button>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
          <button type="submit" className="sigsam-btn" disabled={isPending}>
            {isPending ? "Guardando agenda..." : "Publicar disponibilidad"}
          </button>
        </div>
      </form>
    </div>
  );
}