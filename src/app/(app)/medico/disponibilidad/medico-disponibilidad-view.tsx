"use client";

import { useState, useTransition } from "react";
import {
  obtenerConfiguracionMesAnterior,
  publicarDisponibilidadMensual,
  type DiaConfiguracion,
} from "@/app/actions/disponibilidad";
import { DiasPublicados } from "./dias-publicados";

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
  
  // US-008 CA1: siempre son exactamente 2 días de atención por semana.
  const [dias, setDias] = useState<DiaConfiguracion[]>([
    { diaSemana: 1, horaDesde: "08:00", horaHasta: "12:00" },
    { diaSemana: 4, horaDesde: "08:00", horaHasta: "12:00" },
  ]);

  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [copiando, startCopia] = useTransition();
  const [mensajeCopia, setMensajeCopia] = useState<string | null>(null);
  // Se incrementa al publicar para que la lista de días publicados se recargue.
  const [versionLista, setVersionLista] = useState(0);

  // US-008 CA1: llena el formulario con los días y horarios del mes anterior.
  const handleCopiarMesAnterior = () => {
    setErrorAccion(null);
    setMensajeExito(null);
    setMensajeCopia(null);

    startCopia(async () => {
      const res = await obtenerConfiguracionMesAnterior({ mes, anio });
      if (res.error || !res.dias || res.dias.length === 0) {
        setErrorAccion(res.error ?? "No se encontró una configuración para copiar.");
        return;
      }

      if (res.dias.length >= 2) {
        setDias(res.dias.slice(0, 2));
        setMensajeCopia(
          `Se copiaron los días y horarios de ${res.mesOrigen}. Revisalos y tocá "Publicar disponibilidad".`,
        );
      } else {
        // El mes anterior tenía un solo día: se copia ese y se mantiene el otro del formulario.
        const copiado = res.dias[0];
        const otro = dias.find((d) => d.diaSemana !== copiado.diaSemana) ?? {
          diaSemana: copiado.diaSemana === 1 ? 4 : 1,
          horaDesde: copiado.horaDesde,
          horaHasta: copiado.horaHasta,
        };
        setDias([copiado, otro].sort((a, b) => a.diaSemana - b.diaSemana));
        setMensajeCopia(
          `En ${res.mesOrigen} había un solo día de atención y se copió ese. Completá el otro día y publicá.`,
        );
      }
    });
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
    setMensajeCopia(null);

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
        setVersionLista((v) => v + 1);
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
              max={hoy.getFullYear()}
              required 
            />
          </div>
        </div>

        <hr style={{ border: "0", borderTop: "1px solid var(--color-line, #d7e2e4)", margin: "24px 0" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
          <h3 style={{ fontSize: "16px", margin: 0 }}>Días de atención (2 por semana)</h3>
          <button
            type="button"
            onClick={handleCopiarMesAnterior}
            className="sigsam-btn secondary small"
            disabled={copiando || isPending}
          >
            {copiando ? "Buscando…" : "Copiar del mes anterior"}
          </button>
        </div>

        {mensajeCopia && (
          <div className="sigsam-notice info" role="status" style={{ marginBottom: "16px" }}>
            <span className="sigsam-notice-symbol" aria-hidden="true">i</span>
            <p style={{ margin: 0, fontSize: "14px" }}>{mensajeCopia}</p>
          </div>
        )}
        
        {dias.map((dia, index) => (
          <div key={index} style={{ display: "flex", gap: "12px", alignItems: "flex-end", marginBottom: "16px" }}>
            <div className="sigsam-field" style={{ flex: 2 }}>
              <label>{index === 0 ? "Primer día" : "Segundo día"}</label>
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
          </div>
        ))}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
          <button type="submit" className="sigsam-btn" disabled={isPending}>
            {isPending ? "Guardando agenda..." : "Publicar disponibilidad"}
          </button>
        </div>
      </form>

      <DiasPublicados key={`${mes}-${anio}-${versionLista}`} mes={mes} anio={anio} />
    </div>
  );
}