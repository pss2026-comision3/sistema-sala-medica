"use client";

import { useActionState } from "react";

import { cambiarClave, type EstadoFormulario } from "@/app/actions/auth";

const ESTADO_INICIAL: EstadoFormulario = {};

type Props = {
  camposIniciales: EstadoFormulario["campos"];
};

export function CambiarClaveForm({ camposIniciales }: Props) {
  const [estado, formAction, pendiente] = useActionState(
    cambiarClave,
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
          <label htmlFor="temporal">Clave temporal *</label>
          <input
            id="temporal"
            name="temporal"
            type="password"
            autoComplete="current-password"
            defaultValue={
              estado.campos?.temporal ?? camposIniciales?.temporal ?? ""
            }
            required
          />
          <span className="hint">
            Te la dio Administración cuando creó tu cuenta.
          </span>
        </div>

        <div className="sigsam-field full">
          <label htmlFor="nueva">Nueva contraseña *</label>
          <input
            id="nueva"
            name="nueva"
            type="password"
            autoComplete="new-password"
            defaultValue={estado.campos?.nueva ?? camposIniciales?.nueva ?? ""}
            minLength={8}
            required
          />
          <span className="hint">
            Al menos 8 caracteres, distinta de la temporal.
          </span>
        </div>

        <div className="sigsam-field full">
          <label htmlFor="confirmacion">Repetir nueva contraseña *</label>
          <input
            id="confirmacion"
            name="confirmacion"
            type="password"
            autoComplete="new-password"
            defaultValue={
              estado.campos?.confirmacion ?? camposIniciales?.confirmacion ?? ""
            }
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
