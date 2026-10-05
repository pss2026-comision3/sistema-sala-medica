"use client";

import { useActionState } from "react";

import {
  cambiarPasswordVoluntario,
  type EstadoFormulario,
} from "@/app/actions/auth";

const ESTADO_INICIAL: EstadoFormulario = {};

export function CambiarClavePropiaForm() {
  const [estado, formAction, pendiente] = useActionState(
    cambiarPasswordVoluntario,
    ESTADO_INICIAL,
  );

  return (
    <form action={formAction} noValidate>
      {estado.error && (
        <p className="sigsam-alert-error" role="alert">
          {estado.error}
        </p>
      )}

      {estado.exito && (
        <div className="sigsam-notice success" role="status">
          <span className="sigsam-notice-symbol" aria-hidden="true">
            ✓
          </span>
          <div>
            <strong>¡Listo!</strong>
            <p>Tu contraseña se actualizó correctamente.</p>
          </div>
        </div>
      )}

      <div className="sigsam-form-grid" style={{ marginTop: "16px" }}>
        <div className="sigsam-field full">
          <label htmlFor="actual">Contraseña actual *</label>
          <input
            id="actual"
            name="actual"
            type="password"
            autoComplete="current-password"
            required
            defaultValue=""
          />
        </div>

        <div className="sigsam-field full">
          <label htmlFor="nueva">Nueva contraseña *</label>
          <input
            id="nueva"
            name="nueva"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            defaultValue=""
          />
          <span className="hint">
            Al menos 8 caracteres y distinta de la actual.
          </span>
        </div>

        <div className="sigsam-field full">
          <label htmlFor="confirmacion">Repetir nueva contraseña *</label>
          <input
            id="confirmacion"
            name="confirmacion"
            type="password"
            autoComplete="new-password"
            required
            defaultValue=""
          />
        </div>
      </div>

      <div className="sigsam-form-actions">
        <button type="submit" className="sigsam-btn" disabled={pendiente}>
          {pendiente ? "Actualizando…" : "Actualizar contraseña"}
        </button>
      </div>
    </form>
  );
}
