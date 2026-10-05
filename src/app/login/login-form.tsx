"use client";

import Link from "next/link";
import { useActionState } from "react";

import { login, type EstadoFormulario } from "@/app/actions/auth";

const ESTADO_INICIAL: EstadoFormulario = {};

export function LoginForm() {
  const [estado, formAction, pendiente] = useActionState(login, ESTADO_INICIAL);

  return (
    <form action={formAction} noValidate>
      {estado.error && (
        <p className="sigsam-alert-error" role="alert">
          {estado.error}
        </p>
      )}

      <div className="sigsam-form-grid" style={{ marginTop: 20 }}>
        <div className="sigsam-field">
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

        <div className="sigsam-field">
          <label htmlFor="password">Contraseña *</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            defaultValue={estado.campos?.password ?? ""}
            required
          />
        </div>

        <div className="full sigsam-form-actions" style={{ marginTop: 0 }}>
          <button type="submit" className="sigsam-btn" disabled={pendiente}>
            {pendiente ? "Ingresando…" : "Ingresar"}
          </button>
        </div>
      </div>

      <div className="sigsam-public-links">
        <Link href="/recuperar" className="sigsam-link">
          Recuperar acceso
        </Link>
      </div>

      <div className="sigsam-notice info">
        <span className="sigsam-notice-symbol" aria-hidden="true">
          i
        </span>
        <div>
          <strong>Alta presencial</strong>
          <p>
            Las cuentas de pacientes las crea Administración. Si todavía no
            tenés acceso, acercate al mostrador.
          </p>
        </div>
      </div>
    </form>
  );
}
