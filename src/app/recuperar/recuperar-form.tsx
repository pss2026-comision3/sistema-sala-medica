"use client";

import { useActionState } from "react";

import { recuperarClave, type EstadoFormulario } from "@/app/actions/auth";

const ESTADO_INICIAL: EstadoFormulario = {};

export function RecuperarForm() {
  const [estado, formAction, pendiente] = useActionState(
    recuperarClave,
    ESTADO_INICIAL,
  );

  return (
    <form action={formAction} noValidate>
      {estado.error && (
        <p className="sigsam-alert-error" role="alert">
          {estado.error}
        </p>
      )}

      <div className="sigsam-form-grid">
        <div className="sigsam-field full">
          <label htmlFor="email">Correo electrónico *</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            defaultValue={estado.campos?.email ?? ""}
            required
          />
        </div>

        <div className="sigsam-field full">
          <label htmlFor="temporal">Clave temporal *</label>
          <input
            id="temporal"
            name="temporal"
            type="password"
            autoComplete="current-password"
            required
          />
          <span className="hint">
            Te la dio Administración al verificar tu identidad.
          </span>
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
          />
          <span className="hint">Al menos 8 caracteres.</span>
        </div>

        <div className="sigsam-field full">
          <label htmlFor="confirmacion">Repetir nueva contraseña *</label>
          <input
            id="confirmacion"
            name="confirmacion"
            type="password"
            autoComplete="new-password"
            required
          />
        </div>
      </div>

      <div className="sigsam-form-actions">
        <button type="submit" className="sigsam-btn" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar nueva clave"}
        </button>
      </div>
    </form>
  );
}
