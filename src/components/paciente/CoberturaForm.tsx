"use client";

import { useActionState, useId } from "react";
import {
  actualizarCobertura,
  type EstadoCobertura,
} from "@/app/actions/cobertura";
import type { CoberturaPaciente } from "@/lib/pacientes/cobertura";

type Props = {
  pacienteId: string;
  /** Solo obras sociales activas del catálogo (US-041 CA3). */
  obrasSociales: { id: string; nombre: string }[];
  cobertura: CoberturaPaciente;
};

const ESTADO_INICIAL: EstadoCobertura = {};

/** US-028 CA1/CA2: seleccionar, actualizar o retirar la cobertura. */
export function CoberturaForm({ pacienteId, obrasSociales, cobertura }: Props) {
  const [estado, formAction, pendiente] = useActionState(
    actualizarCobertura,
    ESTADO_INICIAL,
  );
  const id = useId();

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="pacienteId" value={pacienteId} />

      <p>
        {cobertura ? (
          <>
            <strong>Cobertura registrada:</strong> {cobertura.nombre} · Plan{" "}
            {cobertura.plan} · Afiliado {cobertura.numeroAfiliado}
            {!cobertura.activa && (
              <span className="sigsam-muted">
                {" "}
                (obra social inactiva: no admite nuevas reservas con cobertura)
              </span>
            )}
          </>
        ) : (
          <span className="sigsam-muted">
            Sin obra social: la atención es particular.
          </span>
        )}
      </p>

      {estado.error && (
        <p className="sigsam-alert-error" role="alert">
          {estado.error}
        </p>
      )}
      {estado.mensaje && (
        <p className="sigsam-notice success" role="status">
          {estado.mensaje}
        </p>
      )}

      <div className="sigsam-form-grid" style={{ marginTop: 12 }}>
        <div className="sigsam-field full">
          <label htmlFor={`${id}-os`}>Obra social</label>
          <select
            id={`${id}-os`}
            name="obraSocialId"
            defaultValue={cobertura?.activa ? cobertura.obraSocialId : ""}
          >
            <option value="">Sin obra social</option>
            {obrasSociales.map((os) => (
              <option key={os.id} value={os.id}>
                {os.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="sigsam-field">
          <label htmlFor={`${id}-plan`}>Plan</label>
          <input
            id={`${id}-plan`}
            name="plan"
            type="text"
            maxLength={120}
            defaultValue={cobertura?.plan ?? ""}
          />
        </div>
        <div className="sigsam-field">
          <label htmlFor={`${id}-afiliado`}>Número de afiliado</label>
          <input
            id={`${id}-afiliado`}
            name="numeroAfiliado"
            type="text"
            maxLength={80}
            defaultValue={cobertura?.numeroAfiliado ?? ""}
          />
        </div>
      </div>

      <small className="hint">
        Registrar la cobertura no implica autorización de la obra social.
      </small>

      <div style={{ marginTop: 12 }}>
        <button type="submit" className="sigsam-btn" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar cobertura"}
        </button>
      </div>
    </form>
  );
}
