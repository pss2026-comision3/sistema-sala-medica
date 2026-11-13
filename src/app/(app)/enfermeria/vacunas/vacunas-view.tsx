"use client";

import {
  Check,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  X,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import {
  actualizarVacuna,
  cambiarEstadoVacuna,
  crearVacuna,
} from "@/app/actions/vacunas";
import type { VacunaStock } from "@/lib/vacunacion/tipos";

type Props = { iniciales: VacunaStock[] };

type Filtro = "todas" | "activas" | "inactivas";

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "activas", etiqueta: "Activas" },
  { valor: "inactivas", etiqueta: "Inactivas" },
];

const ALTURA_CAMPO = 48;
const ALTURA_MAXIMA_DESCRIPCION = 180;
const ALTURA_ETIQUETA = 22;

function ajustarAlturaTextarea(textarea: HTMLTextAreaElement): void {
  textarea.style.height = `${ALTURA_CAMPO}px`;
  const altura = Math.max(
    ALTURA_CAMPO,
    Math.min(textarea.scrollHeight, ALTURA_MAXIMA_DESCRIPCION),
  );
  textarea.style.height = `${altura}px`;
  textarea.style.overflowY =
    textarea.scrollHeight > ALTURA_MAXIMA_DESCRIPCION ? "auto" : "hidden";
}

type TextareaAutoajustableProps = {
  id: string;
  name?: string;
  value: string;
  maxLength: number;
  onChange: (valor: string) => void;
};

function TextareaAutoajustable({
  id,
  name,
  value,
  maxLength,
  onChange,
}: TextareaAutoajustableProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) ajustarAlturaTextarea(ref.current);
  }, [value]);

  return (
    <textarea
      ref={ref}
      id={id}
      name={name}
      rows={1}
      maxLength={maxLength}
      value={value}
      onChange={(event) => {
        const textarea = event.currentTarget;
        onChange(textarea.value);
        ajustarAlturaTextarea(textarea);
      }}
      style={{
        minHeight: ALTURA_CAMPO,
        height: ALTURA_CAMPO,
        maxHeight: ALTURA_MAXIMA_DESCRIPCION,
        paddingTop: 10,
        paddingBottom: 10,
        lineHeight: 1.6,
        resize: "none",
        overflowY: "hidden",
      }}
    />
  );
}

function ordenar(vacunas: VacunaStock[]): VacunaStock[] {
  return [...vacunas].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

function formatearFecha(iso: string): string {
  const [anio, mes, dia] = iso.split("-");
  if (!anio || !mes || !dia) return iso;
  return `${dia}/${mes}/${anio}`;
}

export function VacunasView({ iniciales }: Props) {
  const [vacunas, setVacunas] = useState(() => ordenar(iniciales));
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [umbralMinimo, setUmbralMinimo] = useState("0");
  const [edicionId, setEdicionId] = useState<string | null>(null);
  const [nombreEditado, setNombreEditado] = useState("");
  const [descripcionEditada, setDescripcionEditada] = useState("");
  const [umbralEditado, setUmbralEditado] = useState("");
  const [lotesAbiertos, setLotesAbiertos] = useState<Record<string, boolean>>(
    {},
  );
  const [confirmarActivacionId, setConfirmarActivacionId] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);

  function actualizarLista(vacunaActualizada: VacunaStock) {
    setVacunas((actuales) => {
      const existe = actuales.some(
        (vacuna) => vacuna.id === vacunaActualizada.id,
      );
      return ordenar(
        existe
          ? actuales.map((vacuna) =>
              vacuna.id === vacunaActualizada.id
                ? vacunaActualizada
                : vacuna,
            )
          : [...actuales, vacunaActualizada],
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

  async function handleCrear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMensaje(null);

    const umbral = Number(umbralMinimo);
    if (!Number.isInteger(umbral) || umbral < 0 || umbral > 1_000_000) {
      mostrarError(
        "El umbral debe ser un número entero entre 0 y 1.000.000.",
      );
      return;
    }

    setPendiente(true);
    try {
      const resultado = await crearVacuna({
        nombre,
        descripcion,
        umbralMinimo: umbral,
      });
      if ("error" in resultado) {
        mostrarError(resultado.error);
        return;
      }

      actualizarLista(resultado.vacuna);
      setNombre("");
      setDescripcion("");
      setUmbralMinimo("0");
      mostrarExito(resultado.mensaje);
    } finally {
      setPendiente(false);
    }
  }

  async function handleGuardarEdicion(
    event: FormEvent<HTMLFormElement>,
    id: string,
  ) {
    event.preventDefault();
    setError(null);
    setMensaje(null);

    const umbral = Number(umbralEditado);
    if (!Number.isInteger(umbral) || umbral < 0 || umbral > 1_000_000) {
      mostrarError(
        "El umbral debe ser un número entero entre 0 y 1.000.000.",
      );
      return;
    }

    setPendiente(true);

    try {
      const resultado = await actualizarVacuna({
        id,
        nombre: nombreEditado,
        descripcion: descripcionEditada,
        umbralMinimo: umbral,
      });
      if ("error" in resultado) {
        mostrarError(resultado.error);
        return;
      }

      actualizarLista(resultado.vacuna);
      setEdicionId(null);
      mostrarExito(resultado.mensaje);
    } finally {
      setPendiente(false);
    }
  }

  async function handleCambiarEstado(vacuna: VacunaStock, activa: boolean) {
    setError(null);
    setMensaje(null);
    setPendiente(true);

    try {
      const resultado = await cambiarEstadoVacuna({
        id: vacuna.id,
        activa,
      });
      if ("error" in resultado) {
        mostrarError(resultado.error);
        return;
      }

      actualizarLista(resultado.vacuna);
      setConfirmarActivacionId(null);
      mostrarExito(resultado.mensaje);
    } finally {
      setPendiente(false);
    }
  }

  const visibles = vacunas.filter((vacuna) => {
    if (filtro === "activas") return vacuna.activa;
    if (filtro === "inactivas") return !vacuna.activa;
    return true;
  });

  return (
    <section className="sigsam-card">
      <h2>Catálogo de vacunas</h2>
      <p className="sigsam-muted">
        Las dosis disponibles surgen de la suma de los movimientos de cada lote.
        La fecha de vencimiento se muestra como dato informativo.
      </p>

      {mensaje && (
        <div
          className="sigsam-notice success"
          role="status"
          aria-live="polite"
        >
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
        <div className="sigsam-notice error" role="alert" aria-live="assertive">
          <span className="sigsam-notice-symbol" aria-hidden="true">
            !
          </span>
          <div>
            <strong>No se pudo completar la operación</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      <form
        onSubmit={handleCrear}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          alignItems: "start",
          margin: "24px 0",
        }}
      >
        <div className="sigsam-field">
          <label htmlFor="vacuna-nombre">Nombre</label>
          <input
            id="vacuna-nombre"
            name="nombre"
            type="text"
            autoComplete="off"
            maxLength={120}
            required
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            aria-describedby="vacuna-nombre-ayuda"
            style={{ minHeight: ALTURA_CAMPO }}
          />
          <small className="hint" id="vacuna-nombre-ayuda">
            Hasta 120 caracteres. No puede repetirse ignorando mayúsculas.
          </small>
        </div>

        <div className="sigsam-field">
          <label htmlFor="vacuna-descripcion">
            Descripción (opcional)
          </label>
          <TextareaAutoajustable
            id="vacuna-descripcion"
            name="descripcion"
            maxLength={1000}
            value={descripcion}
            onChange={setDescripcion}
          />
        </div>

        <div className="sigsam-field">
          <label htmlFor="vacuna-umbral">Umbral mínimo inicial</label>
          <input
            id="vacuna-umbral"
            name="umbralMinimo"
            type="number"
            min={0}
            max={1_000_000}
            step={1}
            required
            value={umbralMinimo}
            onChange={(event) => setUmbralMinimo(event.target.value)}
            style={{ minHeight: ALTURA_CAMPO }}
          />
          <small className="hint">
            Entero mayor o igual a 0. Podés modificarlo desde la edición de la
            vacuna.
          </small>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <span
            aria-hidden="true"
            style={{ display: "block", height: ALTURA_ETIQUETA }}
          />
          <button
            className="sigsam-btn"
            type="submit"
            disabled={pendiente}
            style={{ minHeight: ALTURA_CAMPO }}
          >
            <Plus size={18} aria-hidden="true" />
            Crear vacuna
          </button>
        </div>
      </form>

      <div
        role="group"
        aria-label="Filtrar vacunas por estado"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 16,
        }}
      >
        {FILTROS.map((opcion) => {
          const activo = filtro === opcion.valor;
          const cantidad = vacunas.filter((vacuna) => {
            if (opcion.valor === "activas") return vacuna.activa;
            if (opcion.valor === "inactivas") return !vacuna.activa;
            return true;
          }).length;
          return (
            <button
              key={opcion.valor}
              type="button"
              aria-pressed={activo}
              className={`sigsam-btn small ${activo ? "" : "secondary"}`}
              onClick={() => setFiltro(opcion.valor)}
            >
              {opcion.etiqueta}
              <span aria-hidden="true">({cantidad})</span>
            </button>
          );
        })}
      </div>

      <div style={{ overflowX: "auto" }}>
        {vacunas.length === 0 ? (
          <div className="sigsam-empty">
            <p>No hay vacunas cargadas.</p>
          </div>
        ) : visibles.length === 0 ? (
          <div className="sigsam-empty">
            <p>No hay vacunas en este filtro.</p>
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              minWidth: 980,
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: 14,
            }}
          >
            <caption className="sr-only">
              Catálogo de vacunas con umbral, dosis disponibles, lotes y estado.
            </caption>
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
                  Descripción
                </th>
                <th scope="col" style={{ padding: "10px 12px" }}>
                  Umbral mínimo
                </th>
                <th scope="col" style={{ padding: "10px 12px" }}>
                  Dosis disponibles
                </th>
                <th
                  scope="col"
                  style={{ padding: "10px 12px", textAlign: "center" }}
                >
                  Lotes
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
              {visibles.map((vacuna) => {
                const lotesAbiertosVacuna = lotesAbiertos[vacuna.id] === true;
                const sinStock = vacuna.dosisDisponibles === 0;
                return (
                  <Fragment key={vacuna.id}>
                    <tr
                      style={{
                        borderBottom: "1px solid var(--color-line, #d7e2e4)",
                      }}
                    >
                      <td style={{ padding: "12px" }}>
                        <strong>{vacuna.nombre}</strong>
                      </td>
                      <td style={{ padding: "12px" }}>
                        {vacuna.descripcion ?? "—"}
                      </td>
                      <td style={{ padding: "12px" }}>
                        {vacuna.umbralMinimo}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <strong>{vacuna.dosisDisponibles}</strong>
                      </td>
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: 38,
                          }}
                        >
                          {vacuna.lotes.length === 0 ? (
                            <span className="sigsam-muted">Sin lotes</span>
                          ) : (
                            <button
                              type="button"
                              className="sigsam-btn ghost small"
                              aria-expanded={lotesAbiertosVacuna}
                              aria-controls={`lotes-vacuna-${vacuna.id}`}
                              onClick={() =>
                                setLotesAbiertos((actuales) => ({
                                  ...actuales,
                                  [vacuna.id]: !actuales[vacuna.id],
                                }))
                              }
                            >
                              {lotesAbiertosVacuna ? (
                                <ChevronDown size={16} aria-hidden="true" />
                              ) : (
                                <ChevronRight size={16} aria-hidden="true" />
                              )}
                              Ver lotes ({vacuna.lotes.length})
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            minHeight: 28,
                            padding: "3px 9px",
                            borderRadius: 999,
                            backgroundColor: vacuna.activa
                              ? "#e9f5ed"
                              : "#eef1f2",
                            color: vacuna.activa ? "#23613a" : "#52656a",
                            fontSize: 13,
                            fontWeight: 700,
                          }}
                        >
                          {vacuna.activa ? "Activa" : "Inactiva"}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "8px 12px",
                          textAlign: "right",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <div
                          style={{
                            display: "inline-flex",
                            flexWrap: "wrap",
                            justifyContent: "flex-end",
                            alignItems: "center",
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
                              setEdicionId(vacuna.id);
                              setNombreEditado(vacuna.nombre);
                              setDescripcionEditada(vacuna.descripcion ?? "");
                              setUmbralEditado(String(vacuna.umbralMinimo));
                              setConfirmarActivacionId(null);
                            }}
                            aria-label={`Editar ${vacuna.nombre}`}
                          >
                            <Pencil size={16} aria-hidden="true" />
                            Editar
                          </button>

                          {vacuna.activa ? (
                            <button
                              className="sigsam-btn danger small"
                              type="button"
                              disabled={pendiente || !sinStock}
                              onClick={() =>
                                handleCambiarEstado(vacuna, false)
                              }
                              aria-label={`Desactivar ${vacuna.nombre}`}
                              aria-describedby={
                                !sinStock
                                  ? `motivo-desactivar-${vacuna.id}`
                                  : undefined
                              }
                            >
                              <Power size={16} aria-hidden="true" />
                              Desactivar
                            </button>
                          ) : confirmarActivacionId === vacuna.id ? (
                            <>
                              <span
                                className="sigsam-muted"
                                style={{ fontSize: 13 }}
                              >
                                ¿Confirmás activar {vacuna.nombre}?
                              </span>
                              <button
                                className="sigsam-btn small"
                                type="button"
                                disabled={pendiente}
                                onClick={() =>
                                  handleCambiarEstado(vacuna, true)
                                }
                                aria-label={`Confirmar activación de ${vacuna.nombre}`}
                              >
                                <Check size={16} aria-hidden="true" />
                                Sí, activar
                              </button>
                              <button
                                className="sigsam-btn ghost small"
                                type="button"
                                disabled={pendiente}
                                onClick={() => setConfirmarActivacionId(null)}
                                aria-label={`Cancelar activación de ${vacuna.nombre}`}
                              >
                                <X size={16} aria-hidden="true" />
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <button
                              className="sigsam-btn secondary small"
                              type="button"
                              disabled={pendiente}
                              onClick={() => {
                                setError(null);
                                setMensaje(null);
                                setConfirmarActivacionId(vacuna.id);
                              }}
                              aria-label={`Activar ${vacuna.nombre}`}
                            >
                              <RotateCcw size={16} aria-hidden="true" />
                              Activar
                            </button>
                          )}
                        </div>
                        {vacuna.activa && !sinStock && (
                          <span
                            id={`motivo-desactivar-${vacuna.id}`}
                            className="sigsam-muted"
                            style={{
                              display: "block",
                              fontSize: 12,
                              marginTop: 4,
                              whiteSpace: "normal",
                            }}
                          >
                            No se puede desactivar: tiene{" "}
                            {vacuna.dosisDisponibles} dosis disponibles.
                          </span>
                        )}
                      </td>
                    </tr>

                    {edicionId === vacuna.id && (
                      <tr>
                        <td
                          colSpan={7}
                          style={{
                            padding: "12px",
                            backgroundColor: "#f8fbfb",
                            borderBottom:
                              "1px solid var(--color-line, #d7e2e4)",
                          }}
                        >
                          <form
                            onSubmit={(event) =>
                              handleGuardarEdicion(event, vacuna.id)
                            }
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit, minmax(220px, 1fr))",
                              gap: 12,
                              alignItems: "start",
                            }}
                          >
                            <div className="sigsam-field">
                              <label
                                htmlFor={`editar-nombre-${vacuna.id}`}
                                style={{
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                Nombre de {vacuna.nombre}
                              </label>
                              <input
                                id={`editar-nombre-${vacuna.id}`}
                                type="text"
                                maxLength={120}
                                required
                                value={nombreEditado}
                                onChange={(event) =>
                                  setNombreEditado(event.target.value)
                                }
                                style={{ minHeight: ALTURA_CAMPO }}
                              />
                            </div>

                            <div className="sigsam-field">
                              <label
                                htmlFor={`editar-descripcion-${vacuna.id}`}
                                style={{
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                Descripción de {vacuna.nombre}
                              </label>
                              <TextareaAutoajustable
                                id={`editar-descripcion-${vacuna.id}`}
                                maxLength={1000}
                                value={descripcionEditada}
                                onChange={setDescripcionEditada}
                              />
                            </div>

                            <div className="sigsam-field">
                              <label
                                htmlFor={`editar-umbral-${vacuna.id}`}
                                style={{
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                Umbral mínimo de {vacuna.nombre}
                              </label>
                              <input
                                id={`editar-umbral-${vacuna.id}`}
                                type="number"
                                min={0}
                                max={1_000_000}
                                step={1}
                                required
                                value={umbralEditado}
                                onChange={(event) =>
                                  setUmbralEditado(event.target.value)
                                }
                                style={{ minHeight: ALTURA_CAMPO }}
                              />
                            </div>

                            <div style={{ display: "grid", gap: 6 }}>
                              <span
                                aria-hidden="true"
                                style={{
                                  display: "block",
                                  height: ALTURA_ETIQUETA,
                                }}
                              />
                              <div
                                style={{
                                  display: "flex",
                                  gap: 8,
                                  flexWrap: "wrap",
                                }}
                              >
                                <button
                                  className="sigsam-btn"
                                  type="submit"
                                  disabled={pendiente}
                                  aria-label={`Guardar cambios de ${vacuna.nombre}`}
                                  style={{ minHeight: ALTURA_CAMPO }}
                                >
                                  <Check size={16} aria-hidden="true" />
                                  Guardar
                                </button>
                                <button
                                  className="sigsam-btn ghost"
                                  type="button"
                                  disabled={pendiente}
                                  onClick={() => setEdicionId(null)}
                                  aria-label={`Cancelar edición de ${vacuna.nombre}`}
                                  style={{ minHeight: ALTURA_CAMPO }}
                                >
                                  <X size={16} aria-hidden="true" />
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}

                    {lotesAbiertosVacuna && (
                      <tr>
                        <td
                          colSpan={7}
                          style={{
                            padding: "0 12px 16px",
                            backgroundColor: "#f8fbfb",
                            borderBottom:
                              "1px solid var(--color-line, #d7e2e4)",
                          }}
                        >
                          <div
                            id={`lotes-vacuna-${vacuna.id}`}
                            style={{ paddingTop: 12 }}
                          >
                            <table
                              style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                textAlign: "left",
                                fontSize: 13,
                              }}
                            >
                              <caption className="sr-only">
                                Lotes de {vacuna.nombre}
                              </caption>
                              <thead>
                                <tr
                                  style={{
                                    color:
                                      "var(--color-ink-muted, #5a737a)",
                                  }}
                                >
                                  <th
                                    scope="col"
                                    style={{ padding: "6px 8px" }}
                                  >
                                    Código
                                  </th>
                                  <th
                                    scope="col"
                                    style={{ padding: "6px 8px" }}
                                  >
                                    Vencimiento
                                  </th>
                                  <th
                                    scope="col"
                                    style={{ padding: "6px 8px" }}
                                  >
                                    Dosis disponibles
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {vacuna.lotes.map((lote) => (
                                  <tr key={lote.id}>
                                    <td style={{ padding: "6px 8px" }}>
                                      <strong>{lote.codigo}</strong>
                                    </td>
                                    <td style={{ padding: "6px 8px" }}>
                                      {formatearFecha(
                                        lote.fechaVencimiento,
                                      )}
                                    </td>
                                    <td style={{ padding: "6px 8px" }}>
                                      {lote.dosisDisponibles}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <p
                              className="sigsam-muted"
                              style={{ fontSize: 12, marginTop: 8 }}
                            >
                              La fecha de vencimiento se muestra como dato
                              informativo.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
