"use client";

import { useState, useActionState } from "react";
import { crearCuentaPersonal, type FormState } from "@/app/actions/cuentas";

type Especialidad = { id: string; nombre: string };
type Campo = "nombreCompleto" | "email" | "rol" | "especialidadId";

function renderError(errors: FormState["errors"], campo: Campo) {
  const mensaje = errors?.[campo]?.[0];

  return mensaje ? <span className="field-error">{mensaje}</span> : null;
}

function renderSuccessDialog(message?: string) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cuenta-creada-titulo"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(10, 30, 36, 0.6)",
      }}
    >
      <div
        className="sigsam-card"
        style={{
          width: "min(100%, 420px)",
          textAlign: "center",
          boxShadow: "0 20px 65px rgba(0, 0, 0, 0.25)",
        }}
      >
        <h2 id="cuenta-creada-titulo" style={{ color: "var(--color-success)" }}>
          Cuenta creada
        </h2>
        <p className="sigsam-muted" style={{ marginBottom: 24 }}>
          {message}
        </p>
        <button
          type="button"
          className="sigsam-btn"
          style={{ width: "100%" }}
          onClick={() => window.location.reload()}
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}

function renderFormMessage(message?: string) {
  if (!message) return null;

  return (
    <div className="sigsam-notice error" style={{ marginBottom: 24 }}>
      <span className="sigsam-notice-symbol" aria-hidden="true">
        !
      </span>
      <div>
        <strong>Hay datos por corregir</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}

function renderTextField({
  id,
  label,
  type = "text",
  errors,
}: {
  id: "nombreCompleto" | "email";
  label: string;
  type?: "text" | "email";
  errors: FormState["errors"];
}) {
  return (
    <div className="sigsam-field">
      <label htmlFor={id}>{label} *</label>
      <input
        type={type}
        id={id}
        name={id}
        required
        aria-invalid={!!errors?.[id]}
      />
      {renderError(errors, id)}
    </div>
  );
}

function renderRoleField(
  rol: string,
  onChange: (rol: string) => void,
  errors: FormState["errors"],
) {
  return (
    <div className="sigsam-field">
      <label htmlFor="rol">Rol *</label>
      <select
        id="rol"
        name="rol"
        value={rol}
        onChange={(event) => onChange(event.target.value)}
        required
        aria-invalid={!!errors?.rol}
      >
        <option value="ADMIN">Administrador</option>
        <option value="MEDICO">Médico</option>
        <option value="ENFERMERIA">Enfermería</option>
      </select>
      {renderError(errors, "rol")}
    </div>
  );
}

function renderSpecialtyField(
  rol: string,
  especialidades: Especialidad[],
  errors: FormState["errors"],
) {
  const esMedico = rol === "MEDICO";

  return (
    <div
      className="sigsam-field"
      style={{
        opacity: esMedico ? 1 : 0.6,
        transition: "opacity 0.2s",
      }}
    >
      <label htmlFor="especialidadId">Especialidad (si es médico)</label>
      <select
        id="especialidadId"
        name="especialidadId"
        disabled={!esMedico}
        required={esMedico}
        aria-invalid={!!errors?.especialidadId}
        style={{
          cursor: esMedico ? "default" : "not-allowed",
          backgroundColor: esMedico ? "#fff" : "#f5f5f5",
        }}
      >
        <option value="">Seleccioná una especialidad</option>
        {especialidades.map((especialidad) => (
          <option key={especialidad.id} value={especialidad.id}>
            {especialidad.nombre}
          </option>
        ))}
      </select>
      {renderError(errors, "especialidadId")}
    </div>
  );
}

export default function NuevaCuentaForm({
  especialidades,
}: {
  especialidades: Especialidad[];
}) {
  const [state, formAction, isPending] = useActionState(crearCuentaPersonal, {
    success: false,
  });

  const [rol, setRol] = useState("ADMIN");

  return (
    <>
      {state.success && renderSuccessDialog(state.message)}

      <form action={formAction} noValidate>
        {!state.success && renderFormMessage(state.message)}

        <div className="sigsam-form-grid">
          {renderTextField({
            id: "nombreCompleto",
            label: "Nombre y apellido",
            errors: state.errors,
          })}
          {renderTextField({
            id: "email",
            label: "Correo electrónico",
            type: "email",
            errors: state.errors,
          })}
          {renderRoleField(rol, setRol, state.errors)}
          {renderSpecialtyField(rol, especialidades, state.errors)}
        </div>

        <div className="sigsam-form-actions">
          <button type="submit" className="sigsam-btn" disabled={isPending}>
            {isPending ? "Creando..." : "Crear cuenta"}
          </button>
          <span className="sigsam-muted" style={{ fontSize: 14 }}>
            La cuenta recibe una clave temporal y debe cambiarla al ingresar.
            (por ahora password123)
          </span>
        </div>
      </form>
    </>
  );
}
