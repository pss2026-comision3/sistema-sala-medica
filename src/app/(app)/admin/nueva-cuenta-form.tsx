"use client";

import { useEffect, useState, useActionState } from "react";
import { crearCuentaPersonal, type FormState } from "@/app/actions/cuentas";

/*
 * Este componente renderiza un formulario para crear una nueva cuenta de personal. Se utiliza en la página de administración.
 */

// Si la acción devuelve un error, también devuelve `valores` y se usan como
// defaultValue: así el formulario no se vacía y solo se marcan los errores.

type Especialidad = { id: string; nombre: string };
type Campo = "nombre" | "apellido" | "email" | "rol" | "especialidadId";

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
  defaultValue = "",
  anchoCompleto = false,
}: {
  id: "nombre" | "apellido" | "email";
  label: string;
  type?: "text" | "email";
  errors: FormState["errors"];
  defaultValue?: string;
  anchoCompleto?: boolean;
}) {
  return (
    <div
      className="sigsam-field"
      style={anchoCompleto ? { gridColumn: "1 / -1" } : undefined}
    >
      <label htmlFor={id}>{label} *</label>
      <input
        type={type}
        id={id}
        name={id}
        required
        maxLength={id === "email" ? 255 : 120}
        autoComplete="off"
        defaultValue={defaultValue}
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
  especialidadId: string,
  onChange: (especialidadId: string) => void,
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
        value={especialidadId}
        onChange={(event) => onChange(event.target.value)}
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
  const [especialidadId, setEspecialidadId] = useState("");
  const valores = state.success ? undefined : state.valores;

  // Los dos select son controlados: tras un error se restauran desde `valores`.
  useEffect(() => {
    if (state.success || !state.valores) return;
    if (state.valores.rol) setRol(state.valores.rol);
    setEspecialidadId(state.valores.especialidadId);
  }, [state]);

  return (
    <>
      {state.success && renderSuccessDialog(state.message)}

      <form action={formAction} noValidate>
        {!state.success && renderFormMessage(state.message)}

        <div
          className="sigsam-form-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
            alignItems: "start",
          }}
        >
          {renderTextField({
            id: "nombre",
            defaultValue: valores?.nombre,
            label: "Nombre/s",
            errors: state.errors,
          })}
          {renderTextField({
            id: "apellido",
            defaultValue: valores?.apellido,
            label: "Apellido/s",
            errors: state.errors,
          })}
          {renderTextField({
            id: "email",
            label: "Correo electrónico",
            type: "email",
            errors: state.errors,
            defaultValue: valores?.email,
            anchoCompleto: true,
          })}
          {renderRoleField(rol, setRol, state.errors)}
          {renderSpecialtyField(
            rol,
            especialidades,
            state.errors,
            especialidadId,
            setEspecialidadId,
          )}
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