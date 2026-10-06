"use client";

import { useState } from "react";
import type { FiltrosHorarios } from "@/lib/turnos/buscar-horarios";
import styles from "./buscar.module.css";

type Beneficiario = { id: string; nombre: string; tipo: string };
type Especialidad = {
  id: string;
  nombre: string;
  medicos: { id: string; nombre: string }[];
};

export function BuscarForm({
  beneficiarios,
  catalogo,
  filtros,
  hoy,
}: {
  beneficiarios: Beneficiario[];
  catalogo: Especialidad[];
  filtros: FiltrosHorarios;
  hoy: string;
}) {
  const [especialidad, setEspecialidad] = useState(filtros.especialidad ?? "");
  const [medico, setMedico] = useState(filtros.medico ?? "");
  const medicos =
    catalogo.find((item) => item.id === especialidad)?.medicos ?? [];

  return (
    <form method="get" className={styles.formulario}>
      <input type="hidden" name="buscar" value="1" />
      <div className="sigsam-field">
        <label htmlFor="beneficiario">Beneficiario *</label>
        <select
          id="beneficiario"
          name="beneficiario"
          defaultValue={filtros.beneficiario ?? ""}
          required
        >
          <option value="">Elegí el paciente atendido</option>
          {beneficiarios.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nombre} · {b.tipo}
            </option>
          ))}
        </select>
      </div>
      <div className="sigsam-field">
        <label htmlFor="especialidad">Especialidad *</label>
        <select
          id="especialidad"
          name="especialidad"
          value={especialidad}
          onChange={(event) => {
            setEspecialidad(event.target.value);
            setMedico("");
          }}
          required
        >
          <option value="">Elegí una especialidad</option>
          {catalogo.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="sigsam-field">
        <label htmlFor="medico">Profesional</label>
        <select
          id="medico"
          name="medico"
          value={medico}
          onChange={(event) => setMedico(event.target.value)}
        >
          <option value="">Cualquier profesional</option>
          {medicos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="sigsam-field">
        <label htmlFor="fecha">Fecha desde *</label>
        <input
          id="fecha"
          name="fecha"
          type="date"
          min={hoy}
          defaultValue={filtros.fecha ?? hoy}
          required
        />
      </div>
      <div className={styles.acciones}>
        <button type="submit" className="sigsam-btn small">
          Buscar horarios
        </button>
      </div>
    </form>
  );
}
