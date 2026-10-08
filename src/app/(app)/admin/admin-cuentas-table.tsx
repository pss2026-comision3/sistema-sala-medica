"use client";

import { useId, useState, useTransition, useActionState } from "react";

import { ETIQUETA_ROL } from "@/lib/auth/constants";
import type { Rol } from "@/generated/prisma/client";
import {
  restablecerClavePorAdmin,
  type ResultadoRestablecimiento,
} from "@/app/actions/auth";
import { desactivarCuentaPersonal } from "@/app/actions/cuentas";

export type CuentaItem = {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  claveTemporal: boolean;
};

type Props = {
  cuentasIniciales: CuentaItem[];
};

export function AdminCuentasTable({ cuentasIniciales }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [cuentaParaReset, setCuentaParaReset] = useState<CuentaItem | null>(
    null,
  );

  // Estados para el nuevo modal de desactivación
  const [cuentaParaDesactivar, setCuentaParaDesactivar] =
    useState<CuentaItem | null>(null);
  const [stateDesactivar, actionDesactivar, isPendingDesactivar] =
    useActionState(desactivarCuentaPersonal, { success: false });

  const [resultado, setResultado] =
    useState<ResultadoRestablecimiento["credenciales"]>(undefined);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [isPending, startTransition] = useTransition();

  const searchInputId = useId();

  const normalizado = busqueda.trim().toLowerCase();
  const cuentasFiltradas = cuentasIniciales.filter(
    (c) =>
      c.nombre.toLowerCase().includes(normalizado) ||
      c.email.toLowerCase().includes(normalizado),
  );

  // CA2: Contamos los admins activos para ocultar el botón si es el último
  const adminsActivosCount = cuentasIniciales.filter(
    (c) => c.rol === "ADMIN" && c.activo,
  ).length;

  function handleConfirmarReset() {
    if (!cuentaParaReset) return;
    setErrorAccion(null);

    startTransition(async () => {
      const res = await restablecerClavePorAdmin(cuentaParaReset.id);
      if (res.error) {
        setErrorAccion(res.error);
      } else if (res.credenciales) {
        setResultado(res.credenciales);
        setCuentaParaReset(null);
      }
    });
  }

  async function handleCopiarCredenciales() {
    if (!resultado) return;
    const texto = `SIGSAM - Credenciales de acceso presencial:\nUsuario: ${resultado.email}\nClave temporal: ${resultado.claveTemporal}\n(El cambio de clave es obligatorio al ingresar)`;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Ignorar
    }
  }

  // Cerrar el modal de desactivar y recargar si fue exitoso
  function handleCerrarModalDesactivar() {
    setCuentaParaDesactivar(null);
    if (stateDesactivar.success) {
      window.location.reload();
    }
  }

  return (
    <div>
      {/* Aviso de credenciales recién generadas */}
      {resultado && (
        <div
          className="sigsam-notice success"
          role="status"
          style={{ marginBottom: "24px" }}
        >
          <span className="sigsam-notice-symbol" aria-hidden="true">
            ✓
          </span>
          <div style={{ width: "100%" }}>
            <strong>Credenciales para entregar (Asistencia presencial)</strong>
            <p style={{ marginTop: "6px" }}>
              Se generó una clave temporal para{" "}
              <strong>{resultado.nombre}</strong>. Sus sesiones anteriores se
              cerraron de inmediato.
            </p>

            <div
              style={{
                marginTop: "12px",
                padding: "12px",
                backgroundColor: "#fff",
                border: "1px solid #bfddcb",
                borderRadius: "6px",
                display: "flex",
                flexWrap: "wrap",
                gap: "16px",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div>
                  <span className="sigsam-muted" style={{ fontSize: "13px" }}>
                    Usuario:
                  </span>{" "}
                  <strong>{resultado.email}</strong>
                </div>
                <div style={{ marginTop: "4px" }}>
                  <span className="sigsam-muted" style={{ fontSize: "13px" }}>
                    Clave temporal:
                  </span>{" "}
                  <code
                    style={{
                      fontSize: "16px",
                      fontWeight: "700",
                      backgroundColor: "#eaf3f3",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      color: "#145f65",
                    }}
                  >
                    {resultado.claveTemporal}
                  </code>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={handleCopiarCredenciales}
                  className="sigsam-btn secondary small"
                >
                  {copiado ? "Copiado ✓" : "Copiar credenciales"}
                </button>
                <button
                  type="button"
                  onClick={() => setResultado(undefined)}
                  className="sigsam-btn-ghost small"
                >
                  Cerrar aviso
                </button>
              </div>
            </div>

            <p
              className="sigsam-muted"
              style={{ fontSize: "12px", marginTop: "8px" }}
            >
              Entregá esta clave en mano al solicitante. Deberá cambiarla
              obligatoriamente al volver a ingresar al sistema.
            </p>
          </div>
        </div>
      )}

      {errorAccion && (
        <p className="sigsam-alert-error" role="alert">
          {errorAccion}
        </p>
      )}

      <div style={{ marginBottom: "20px" }}>
        <div className="sigsam-field" style={{ maxWidth: "420px" }}>
          <label htmlFor={searchInputId}>
            Buscar cuenta por nombre o correo
          </label>
          <input
            id={searchInputId}
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Ej. Valeria, medico@sigsam.local..."
            autoComplete="off"
          />
        </div>
      </div>

      {cuentasFiltradas.length === 0 ? (
        <div className="sigsam-empty">
          <p>No se encontraron cuentas activas con ese criterio.</p>
        </div>
      ) : (
        <div
          style={{
            border: "1px solid var(--color-line)",
            borderRadius: "8px",
            overflow: "hidden",
            backgroundColor: "#fff",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
                fontSize: "14px",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--color-line)",
                    backgroundColor: "var(--color-brand-soft)",
                    color: "var(--color-ink)",
                  }}
                >
                  <th style={{ padding: "12px 16px", fontWeight: "700" }}>
                    Usuario / Persona
                  </th>
                  <th style={{ padding: "12px 16px", fontWeight: "700" }}>
                    Rol
                  </th>
                  <th style={{ padding: "12px 16px", fontWeight: "700" }}>
                    Estado
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      fontWeight: "700",
                      textAlign: "right",
                    }}
                  >
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {cuentasFiltradas.map((cuenta) => {
                  // Ocultar botón de desactivar si es el último admin activo
                  const esUltimoAdmin =
                    cuenta.rol === "ADMIN" &&
                    cuenta.activo &&
                    adminsActivosCount <= 1;

                  return (
                    <tr
                      key={cuenta.id}
                      style={{ borderBottom: "1px solid var(--color-line)" }}
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <strong>{cuenta.nombre}</strong>
                        <div
                          className="sigsam-muted"
                          style={{ fontSize: "13px", marginTop: "2px" }}
                        >
                          {cuenta.email}
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {ETIQUETA_ROL[cuenta.rol]}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontWeight: "700",
                            backgroundColor: cuenta.activo
                              ? "#edf7f1"
                              : "#fcf0f0",
                            color: cuenta.activo ? "#1b6338" : "#b4393a",
                          }}
                        >
                          {cuenta.activo ? "Activa" : "Desactivada"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        {cuenta.activo ? (
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              justifyContent: "flex-end",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setErrorAccion(null);
                                setCuentaParaReset(cuenta);
                              }}
                              className="sigsam-btn secondary small"
                            >
                              Clave temporal
                            </button>

                            {!esUltimoAdmin && (
                              <button
                                type="button"
                                onClick={() => setCuentaParaDesactivar(cuenta)}
                                className="sigsam-btn danger small"
                              >
                                Desactivar
                              </button>
                            )}
                          </div>
                        ) : (
                          <span
                            className="sigsam-muted"
                            style={{ fontSize: "13px" }}
                          >
                            Sin acciones
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal / Diálogo para Desactivar Cuenta */}
      {cuentaParaDesactivar && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(16, 42, 49, 0.6)",
            display: "grid",
            placeItems: "center",
            padding: "16px",
            zIndex: 50,
          }}
        >
          <div
            className="sigsam-card"
            style={{
              maxWidth: "480px",
              width: "100%",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
          >
            <div className="sigsam-eyebrow">Baja lógica</div>
            <h2 style={{ fontSize: "20px" }}>Desactivar cuenta</h2>
            <p
              className="sigsam-muted"
              style={{ marginTop: "8px", marginBottom: "16px" }}
            >
              ¿Desactivar el acceso de{" "}
              <strong>{cuentaParaDesactivar.nombre}</strong>? Sus registros se
              conservarán.
            </p>

            {/* Mostramos el mensaje de error del Server Action acá mismo */}
            {!stateDesactivar.success && stateDesactivar.message && (
              <div
                className="sigsam-notice error"
                style={{ marginBottom: "16px" }}
              >
                <span className="sigsam-notice-symbol" aria-hidden="true">
                  !
                </span>
                <div>
                  <strong>No se puede desactivar</strong>
                  <p>{stateDesactivar.message}</p>
                </div>
              </div>
            )}

            {stateDesactivar.success ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: "24px",
                }}
              >
                <button
                  type="button"
                  onClick={handleCerrarModalDesactivar}
                  className="sigsam-btn"
                >
                  Aceptar y cerrar
                </button>
              </div>
            ) : (
              <form action={actionDesactivar}>
                <input
                  type="hidden"
                  name="usuarioId"
                  value={cuentaParaDesactivar.id}
                />

                <div className="sigsam-field" style={{ marginBottom: "20px" }}>
                  <label htmlFor="motivo">Motivo de la desactivación *</label>
                  <input
                    type="text"
                    id="motivo"
                    name="motivo"
                    required
                    placeholder="Ej. Fin de contrato, reemplazo, etc."
                    aria-invalid={!!stateDesactivar.errors?.motivo}
                  />
                  {stateDesactivar.errors?.motivo && (
                    <span
                      className="sigsam-alert-error"
                      style={{
                        color: "#b4393a",
                        fontSize: "13px",
                        fontWeight: "700",
                        display: "block",
                        marginTop: "4px",
                      }}
                    >
                      {stateDesactivar.errors.motivo[0]}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "12px",
                  }}
                >
                  <button
                    type="button"
                    onClick={handleCerrarModalDesactivar}
                    className="sigsam-btn-ghost"
                    disabled={isPendingDesactivar}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="sigsam-btn danger"
                    disabled={isPendingDesactivar}
                  >
                    {isPendingDesactivar
                      ? "Desactivando…"
                      : "Confirmar desactivación"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal / Diálogo de confirmación para clave temporal */}
      {cuentaParaReset && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-reset-title"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(16, 42, 49, 0.6)",
            display: "grid",
            placeItems: "center",
            padding: "16px",
            zIndex: 50,
          }}
        >
          <div
            className="sigsam-card"
            style={{
              maxWidth: "480px",
              width: "100%",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
          >
            <div className="sigsam-eyebrow">Recuperación presencial</div>
            <h2 id="modal-reset-title" style={{ fontSize: "20px" }}>
              Generar clave temporal
            </h2>
            <p className="sigsam-muted" style={{ marginTop: "8px" }}>
              ¿Confirmás el restablecimiento para{" "}
              <strong>{cuentaParaReset.nombre}</strong> ({cuentaParaReset.email}
              )?
            </p>
            <div
              className="sigsam-notice warning"
              style={{ marginTop: "16px", marginBottom: "20px" }}
            >
              <span className="sigsam-notice-symbol" aria-hidden="true">
                !
              </span>
              <div>
                <strong>Efectos inmediatos</strong>
                <p style={{ fontSize: "13px" }}>
                  Todas las sesiones abiertas del usuario se cerrarán
                  automáticamente y la contraseña anterior dejará de servir.
                  Deberá definir una nueva clave al volver a entrar.
                </p>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => setCuentaParaReset(null)}
                className="sigsam-btn-ghost"
                disabled={isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarReset}
                className="sigsam-btn"
                disabled={isPending}
              >
                {isPending ? "Generando…" : "Generar clave"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
