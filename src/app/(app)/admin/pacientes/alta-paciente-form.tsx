"use client";

import { useActionState } from "react";

import {
  altaPacienteAdulto,
  type EstadoAltaPaciente,
} from "@/app/actions/pacientes";

export type ObraSocialItem = { id: string; nombre: string };

type Props = {
  obrasSociales: ObraSocialItem[];
  fechaMaxima: string;
};

const ESTADO_INICIAL: EstadoAltaPaciente = {};

function formatearFecha(iso: string): string {
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

export function AltaPacienteForm({ obrasSociales, fechaMaxima }: Props) {
  const [estado, formAction, pendiente] = useActionState(
    altaPacienteAdulto,
    ESTADO_INICIAL,
  );
  const campos = estado.campos ?? {};
  const coincidencias = estado.coincidenciasDni ?? [];

  return (
    <>
      {estado.exito && (
        <div
          className="sigsam-notice success"
          role="status"
          style={{ marginBottom: 20 }}
        >
          <span className="sigsam-notice-symbol" aria-hidden="true">
            ✓
          </span>
          <div>
            <strong>Credenciales para entregar</strong>
            <p>
              {estado.exito.nombre} · Usuario:{" "}
              <strong>{estado.exito.email}</strong> · Clave temporal:{" "}
              <code>{estado.exito.claveTemporal}</code>
            </p>
            <p>
              {estado.exito.registroExistente
                ? "La cuenta se vinculó al registro de paciente existente. "
                : "El paciente quedó registrado. "}
              El cambio de clave es obligatorio al ingresar. Esta clave no se
              vuelve a mostrar.
            </p>
          </div>
        </div>
      )}

      <form action={formAction} noValidate>
        {estado.error && (
          <p className="sigsam-alert-error" role="alert">
            {estado.error}
          </p>
        )}

        <div className="sigsam-form-grid" style={{ marginTop: 20 }}>
          <div className="sigsam-field">
            <label htmlFor="alta-nombre">Nombre *</label>
            <input
              id="alta-nombre"
              name="nombre"
              type="text"
              autoComplete="off"
              maxLength={120}
              defaultValue={campos.nombre ?? ""}
              required
            />
          </div>

          <div className="sigsam-field">
            <label htmlFor="alta-apellido">Apellido *</label>
            <input
              id="alta-apellido"
              name="apellido"
              type="text"
              autoComplete="off"
              maxLength={120}
              defaultValue={campos.apellido ?? ""}
              required
            />
          </div>

          <div className="sigsam-field">
            <label htmlFor="alta-dni">DNI *</label>
            <input
              id="alta-dni"
              name="dni"
              type="text"
              inputMode="numeric"
              maxLength={20}
              defaultValue={campos.dni ?? ""}
              required
            />
            <small className="hint">Sin puntos.</small>
          </div>

          <div className="sigsam-field">
            <label htmlFor="alta-fecha">Fecha de nacimiento *</label>
            <input
              id="alta-fecha"
              name="fechaNacimiento"
              type="date"
              max={fechaMaxima}
              defaultValue={campos.fechaNacimiento ?? ""}
              required
            />
          </div>

          <div className="sigsam-field">
            <label htmlFor="alta-telefono">Teléfono *</label>
            <input
              id="alta-telefono"
              name="telefono"
              type="tel"
              autoComplete="off"
              maxLength={30}
              defaultValue={campos.telefono ?? ""}
              required
            />
          </div>

          <div className="sigsam-field">
            <label htmlFor="alta-email">Correo electrónico *</label>
            <input
              id="alta-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="off"
              maxLength={255}
              defaultValue={campos.email ?? ""}
              required
            />
            <small className="hint">Será el usuario para ingresar.</small>
          </div>

          <div className="sigsam-field full">
            <label htmlFor="alta-obra-social">Obra social (opcional)</label>
            <select
              id="alta-obra-social"
              name="obraSocialId"
              defaultValue={campos.obraSocialId ?? ""}
            >
              <option value="">Sin obra social</option>
              {obrasSociales.map((os) => (
                <option key={os.id} value={os.id}>
                  {os.nombre}
                </option>
              ))}
            </select>
            {obrasSociales.length === 0 && (
              <small className="hint">
                No hay obras sociales activas en el catálogo; el alta se
                registra sin cobertura.
              </small>
            )}
          </div>

          {obrasSociales.length > 0 && (
            <>
              <div className="sigsam-field">
                <label htmlFor="alta-plan">Plan</label>
                <input
                  id="alta-plan"
                  name="plan"
                  type="text"
                  maxLength={120}
                  defaultValue={campos.plan ?? ""}
                />
                <small className="hint">
                  Obligatorio si elegís obra social.
                </small>
              </div>

              <div className="sigsam-field">
                <label htmlFor="alta-afiliado">Número de afiliado</label>
                <input
                  id="alta-afiliado"
                  name="numeroAfiliado"
                  type="text"
                  maxLength={80}
                  defaultValue={campos.numeroAfiliado ?? ""}
                />
                <small className="hint">
                  Obligatorio si elegís obra social.
                </small>
              </div>
            </>
          )}

          {coincidencias.length > 0 && (
            <fieldset className="full" style={{ border: 0, padding: 0 }}>
              <div className="sigsam-notice warning">
                <span className="sigsam-notice-symbol" aria-hidden="true">
                  !
                </span>
                <div>
                  <strong>DNI ya registrado</strong>
                  <p>
                    Verificá presencialmente la identidad. Podés crear la cuenta
                    sobre un registro existente sin cuenta (sus datos no se
                    modifican) o registrar otro paciente indicando el motivo.
                  </p>
                </div>
              </div>

              <div
                role="radiogroup"
                aria-label="Cómo continuar con el DNI"
                style={{ display: "grid", gap: 8, marginTop: 12 }}
              >
                {coincidencias.map((c) => {
                  const habilitada = !c.tieneCuenta && c.esAdulto;
                  return (
                    <label
                      key={c.personaId}
                      style={{ display: "flex", gap: 10, alignItems: "start" }}
                    >
                      <input
                        type="radio"
                        name="resolucionDni"
                        value={`usar:${c.personaId}`}
                        defaultChecked={
                          campos.resolucionDni === `usar:${c.personaId}`
                        }
                        disabled={!habilitada}
                      />
                      <span>
                        Usar el registro de <strong>{c.nombre}</strong> (nac.{" "}
                        {formatearFecha(c.fechaNacimiento)})
                        {c.tieneCuenta && " · ya tiene cuenta"}
                        {!c.tieneCuenta && !c.esAdulto && " · menor de 18 años"}
                      </span>
                    </label>
                  );
                })}

                <label
                  style={{ display: "flex", gap: 10, alignItems: "start" }}
                >
                  <input
                    type="radio"
                    name="resolucionDni"
                    value="nuevo"
                    defaultChecked={campos.resolucionDni === "nuevo"}
                  />
                  <span>Registrar otro paciente con el mismo DNI</span>
                </label>
              </div>

              <div className="sigsam-field" style={{ marginTop: 12 }}>
                <label htmlFor="alta-motivo">
                  Motivo de la excepción (si registrás otro paciente)
                </label>
                <textarea
                  id="alta-motivo"
                  name="motivoExcepcion"
                  maxLength={500}
                  defaultValue={campos.motivoExcepcion ?? ""}
                />
              </div>
            </fieldset>
          )}

          <div className="full sigsam-form-actions" style={{ marginTop: 0 }}>
            <button type="submit" className="sigsam-btn" disabled={pendiente}>
              {pendiente ? "Guardando…" : "Guardar paciente"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
