"use client";

import { Check, Pencil, Plus, Power, RotateCcw, X } from "lucide-react";
import { useState, useTransition } from "react";

import {
  actualizarNombreObraSocial,
  cambiarEstadoObraSocial,
  crearObraSocial,
  type ObraSocialItem,
} from "@/app/actions/obras-sociales";

type Props = { iniciales: ObraSocialItem[] };

function ordenar(obrasSociales: ObraSocialItem[]): ObraSocialItem[] {
  return [...obrasSociales].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es"),
  );
}

export function ObrasSocialesView({ iniciales }: Props) {
  const [obrasSociales, setObrasSociales] = useState(() => ordenar(iniciales));
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [edicionId, setEdicionId] = useState<string | null>(null);
  const [nombreEditado, setNombreEditado] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, iniciarTransicion] = useTransition();

  function actualizarLista(obraSocialActualizada: ObraSocialItem) {
    setObrasSociales((actuales) => {
      const existe = actuales.some(
        (obraSocial) => obraSocial.id === obraSocialActualizada.id,
      );
      return ordenar(
        existe
          ? actuales.map((obraSocial) =>
              obraSocial.id === obraSocialActualizada.id
                ? obraSocialActualizada
                : obraSocial,
            )
          : [...actuales, obraSocialActualizada],
      );
    });
  }

  function mostrarError(nuevoError: string) {
    setError(nuevoError);
    setMensaje(null);
  }

  function mostrarExito(nuevoMensaje: string) {
    setError(null);
    setMensaje(nuevoMensaje);
  }

  function handleCrear(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMensaje(null);

    iniciarTransicion(async () => {
      const resultado = await crearObraSocial({ nombre: nuevoNombre });
      if ("error" in resultado) {
        mostrarError(resultado.error);
        return;
      }

      actualizarLista(resultado.obraSocial);
      setNuevoNombre("");
      mostrarExito(resultado.mensaje);
    });
  }

  function handleGuardarEdicion(
    event: React.FormEvent<HTMLFormElement>,
    id: string,
  ) {
    event.preventDefault();
    setError(null);
    setMensaje(null);

    iniciarTransicion(async () => {
      const resultado = await actualizarNombreObraSocial({
        id,
        nombre: nombreEditado,
      });
      if ("error" in resultado) {
        mostrarError(resultado.error);
        return;
      }

      actualizarLista(resultado.obraSocial);
      setEdicionId(null);
      mostrarExito(resultado.mensaje);
    });
  }

  function handleCambiarEstado(obraSocial: ObraSocialItem) {
    setError(null);
    setMensaje(null);

    iniciarTransicion(async () => {
      const resultado = await cambiarEstadoObraSocial({
        id: obraSocial.id,
        activa: !obraSocial.activa,
      });
      if ("error" in resultado) {
        mostrarError(resultado.error);
        return;
      }

      actualizarLista(resultado.obraSocial);
      mostrarExito(resultado.mensaje);
    });
  }

  return (
    <section className="sigsam-card">
      <h2>Catálogo</h2>
      <p className="sigsam-muted">
        Las entidades inactivas se conservan en las coberturas existentes, pero
        no pueden seleccionarse para nuevas asignaciones.
      </p>

      {mensaje && (
        <div className="sigsam-notice success" role="status">
          <span className="sigsam-notice-symbol" aria-hidden="true">
            <Check size={16} />
          </span>
          <div>
            <strong>Operación completada</strong>
            <p>{mensaje}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="sigsam-notice error" role="alert">
          <span className="sigsam-notice-symbol" aria-hidden="true">
            !
          </span>
          <div>
            <strong>No se pudo guardar el cambio</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      <form
        onSubmit={handleCrear}
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 12,
          alignItems: "end",
          margin: "24px 0",
        }}
      >
        <div className="sigsam-field">
          <label htmlFor="nueva-obra-social">Nueva obra social o prepaga</label>
          <input
            id="nueva-obra-social"
            name="nombre"
            type="text"
            autoComplete="off"
            maxLength={255}
            required
            value={nuevoNombre}
            onChange={(event) => setNuevoNombre(event.target.value)}
            aria-describedby="nueva-obra-social-ayuda"
          />
          <small className="hint" id="nueva-obra-social-ayuda">
            Hasta 255 caracteres. La comparación ignora mayúsculas y minúsculas.
          </small>
        </div>
        <button className="sigsam-btn" type="submit" disabled={pendiente}>
          <Plus size={18} aria-hidden="true" />
          Agregar
        </button>
      </form>

      <div style={{ overflowX: "auto" }}>
        {obrasSociales.length === 0 ? (
          <div className="sigsam-empty">
            <p>Todavía no hay obras sociales en el catálogo.</p>
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              minWidth: 620,
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: 14,
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "2px solid var(--color-line, #d7e2e4)",
                  color: "var(--color-ink-muted, #5a737a)",
                }}
              >
                <th scope="col" style={{ padding: "10px 12px" }}>
                  Nombre
                </th>
                <th scope="col" style={{ padding: "10px 12px" }}>
                  Estado
                </th>
                <th
                  scope="col"
                  style={{ padding: "10px 12px", textAlign: "right" }}
                >
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {obrasSociales.map((obraSocial) => (
                <tr
                  key={obraSocial.id}
                  style={{
                    borderBottom: "1px solid var(--color-line, #d7e2e4)",
                  }}
                >
                  <td style={{ padding: "12px" }}>
                    {edicionId === obraSocial.id ? (
                      <form
                        onSubmit={(event) =>
                          handleGuardarEdicion(event, obraSocial.id)
                        }
                        style={{ display: "flex", gap: 8, minWidth: 0 }}
                      >
                        <label
                          className="sr-only"
                          htmlFor={`nombre-obra-social-${obraSocial.id}`}
                        >
                          Nombre de {obraSocial.nombre}
                        </label>
                        <input
                          id={`nombre-obra-social-${obraSocial.id}`}
                          type="text"
                          maxLength={255}
                          required
                          value={nombreEditado}
                          onChange={(event) =>
                            setNombreEditado(event.target.value)
                          }
                          style={{
                            minWidth: 0,
                            width: "100%",
                            minHeight: 40,
                            padding: "8px 10px",
                            border: "1px solid #adc2c6",
                            borderRadius: 8,
                          }}
                        />
                        <button
                          className="sigsam-btn secondary small"
                          type="submit"
                          disabled={pendiente}
                          aria-label={`Guardar nombre de ${obraSocial.nombre}`}
                          title="Guardar nombre"
                        >
                          <Check size={17} aria-hidden="true" />
                        </button>
                        <button
                          className="sigsam-btn ghost small"
                          type="button"
                          disabled={pendiente}
                          onClick={() => setEdicionId(null)}
                          aria-label="Cancelar edición"
                          title="Cancelar edición"
                        >
                          <X size={17} aria-hidden="true" />
                        </button>
                      </form>
                    ) : (
                      <strong>{obraSocial.nombre}</strong>
                    )}
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        minHeight: 28,
                        padding: "3px 9px",
                        borderRadius: 999,
                        backgroundColor: obraSocial.activa
                          ? "#e9f5ed"
                          : "#eef1f2",
                        color: obraSocial.activa ? "#23613a" : "#52656a",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {obraSocial.activa ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "8px 12px",
                      textAlign: "right",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {edicionId !== obraSocial.id && (
                      <div
                        style={{
                          display: "inline-flex",
                          flexWrap: "wrap",
                          justifyContent: "flex-end",
                          gap: 8,
                        }}
                      >
                        <button
                          className="sigsam-btn secondary small"
                          type="button"
                          disabled={pendiente}
                          onClick={() => {
                            setError(null);
                            setMensaje(null);
                            setEdicionId(obraSocial.id);
                            setNombreEditado(obraSocial.nombre);
                          }}
                        >
                          <Pencil size={16} aria-hidden="true" />
                          Editar
                        </button>
                        <button
                          className={`sigsam-btn small ${obraSocial.activa ? "danger" : "secondary"}`}
                          type="button"
                          disabled={pendiente}
                          onClick={() => handleCambiarEstado(obraSocial)}
                          aria-label={`${obraSocial.activa ? "Desactivar" : "Activar"} ${obraSocial.nombre}`}
                        >
                          {obraSocial.activa ? (
                            <Power size={16} aria-hidden="true" />
                          ) : (
                            <RotateCcw size={16} aria-hidden="true" />
                          )}
                          {obraSocial.activa ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
