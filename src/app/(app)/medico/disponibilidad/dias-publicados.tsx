"use client";

import { useEffect, useState, useTransition } from "react";
import {
  editarHorarioDia,
  listarDisponibilidadMes,
  quitarDiaDisponibilidad,
  type DiaPublicado,
} from "@/app/actions/disponibilidad";

/*
 * US-008 CA4: lista de los días publicados del mes elegido.
 * Solo los días futuros sin turnos confirmados ni retenciones activas se pueden
 * editar (cambiar el horario) o quitar.
 */

const NOMBRE_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function etiquetaFecha(iso: string): string {
  const texto = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T12:00:00Z`));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function Etiqueta({ dia }: { dia: DiaPublicado }) {
  let texto = "Libre";
  let fondo = "#e6f4ec";
  let color = "#176044";
  if (dia.estado === "SUSPENDIDA") {
    texto = "Suspendido";
    fondo = "#fcf0f0";
    color = "#b4393a";
  } else if (dia.pasado) {
    texto = "Pasado";
    fondo = "#eef1f2";
    color = "#5a737a";
  } else if (dia.ocupados > 0) {
    texto = `Con turnos (${dia.ocupados})`;
    fondo = "#fff4dc";
    color = "#8a5a00";
  }
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "12px",
        fontSize: "12px",
        fontWeight: 700,
        backgroundColor: fondo,
        color,
      }}
    >
      {texto}
    </span>
  );
}

/**
 * El padre lo renderiza con `key` de mes, año y versión: al cambiar alguno se
 * monta de nuevo y vuelve a cargar la lista desde cero.
 */
export function DiasPublicados({ mes, anio }: { mes: number; anio: number }) {
  const [dias, setDias] = useState<DiaPublicado[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  // Error de la fila que se está editando: se muestra junto a ella, no arriba.
  const [errorFila, setErrorFila] = useState<string | null>(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [isPending, startTransition] = useTransition();

  function aplicarListado(res: Awaited<ReturnType<typeof listarDisponibilidadMes>>) {
    setCargando(false);
    if (res.error) {
      setError(res.error);
      setDias([]);
      return;
    }
    setDias(res.dias ?? []);
  }

  async function recargar() {
    aplicarListado(await listarDisponibilidadMes({ mes, anio }));
  }

  // Carga inicial (el estado se actualiza recién cuando llega la respuesta).
  useEffect(() => {
    let activo = true;
    listarDisponibilidadMes({ mes, anio }).then((res) => {
      if (activo) aplicarListado(res);
    });
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, anio]);

  function empezarEdicion(dia: DiaPublicado) {
    setError(null);
    setExito(null);
    setErrorFila(null);
    setEditandoId(dia.id);
    setDesde(dia.horaDesde);
    setHasta(dia.horaHasta);
  }

  function guardarHorario(id: string) {
    setError(null);
    setExito(null);
    setErrorFila(null);
    startTransition(async () => {
      const res = await editarHorarioDia({ id, horaDesde: desde, horaHasta: hasta });
      if (res.error) {
        setErrorFila(res.error);
        // Por si el día cambió de estado (por ejemplo, se reservó un turno).
        await recargar();
        return;
      }
      setExito(res.mensaje ?? "Horario actualizado.");
      setEditandoId(null);
      await recargar();
    });
  }

  function quitar(dia: DiaPublicado) {
    if (
      !window.confirm(
        `¿Quitás el ${etiquetaFecha(dia.fecha).toLowerCase()} de tu disponibilidad? Los pacientes ya no van a poder reservar ese día.`,
      )
    ) {
      return;
    }
    setError(null);
    setExito(null);
    startTransition(async () => {
      const res = await quitarDiaDisponibilidad({ id: dia.id });
      if (res.error) {
        setError(res.error);
        // Por si el día cambió de estado (por ejemplo, se reservó un turno).
        await recargar();
        return;
      }
      setExito(res.mensaje ?? "Día quitado.");
      await recargar();
    });
  }

  return (
    <section className="sigsam-card" style={{ marginTop: "24px" }}>
      <div className="sigsam-eyebrow">Mes elegido</div>
      <h2 style={{ fontSize: "20px", marginBottom: "4px" }}>
        Días publicados de {NOMBRE_MES[mes - 1]} {anio}
      </h2>
      <p className="sigsam-muted" style={{ fontSize: "14px", marginTop: 0 }}>
        Podés cambiar el horario o quitar los días libres. Los días con turnos
        confirmados o retenciones activas no se pueden modificar.
      </p>

      {exito && (
        <div className="sigsam-notice success" role="status" style={{ margin: "12px 0" }}>
          <span className="sigsam-notice-symbol" aria-hidden="true">✓</span>
          <p style={{ margin: 0, fontSize: "14px" }}>{exito}</p>
        </div>
      )}
      {error && (
        <div className="sigsam-notice error" role="alert" style={{ margin: "12px 0" }}>
          <span className="sigsam-notice-symbol" aria-hidden="true">!</span>
          <p style={{ margin: 0, fontSize: "14px" }}>{error}</p>
        </div>
      )}

      {cargando && dias === null ? (
        <p className="sigsam-muted">Cargando días publicados…</p>
      ) : !dias || dias.length === 0 ? (
        <div className="sigsam-empty">
          <p>Todavía no publicaste días para este mes.</p>
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {dias.map((dia) => {
            const editando = editandoId === dia.id;
            return (
              <li
                key={dia.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 0",
                  borderBottom: "1px solid var(--color-line, #d7e2e4)",
                }}
              >
                <div style={{ flex: "1 1 220px" }}>
                  <strong>{etiquetaFecha(dia.fecha)}</strong>
                  {!editando && (
                    <span className="sigsam-muted" style={{ marginLeft: "8px" }}>
                      {dia.horaDesde} a {dia.horaHasta} hs
                    </span>
                  )}
                  <div style={{ marginTop: "4px" }}>
                    <Etiqueta dia={dia} />
                  </div>
                </div>

                {editando ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "flex-end" }}>
                    <div className="sigsam-field">
                      <label htmlFor={`desde-${dia.id}`}>Desde</label>
                      <input
                        id={`desde-${dia.id}`}
                        type="time"
                        value={desde}
                        onChange={(e) => setDesde(e.target.value)}
                        required
                      />
                    </div>
                    <div className="sigsam-field">
                      <label htmlFor={`hasta-${dia.id}`}>Hasta</label>
                      <input
                        id={`hasta-${dia.id}`}
                        type="time"
                        value={hasta}
                        onChange={(e) => setHasta(e.target.value)}
                        required
                      />
                    </div>
                    <button
                      type="button"
                      className="sigsam-btn small"
                      onClick={() => guardarHorario(dia.id)}
                      disabled={isPending}
                    >
                      {isPending ? "Guardando…" : "Guardar"}
                    </button>
                    <button
                      type="button"
                      className="sigsam-btn ghost small"
                      onClick={() => {
                        setEditandoId(null);
                        setErrorFila(null);
                      }}
                      disabled={isPending}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : dia.editable ? (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      className="sigsam-btn secondary small"
                      onClick={() => empezarEdicion(dia)}
                      disabled={isPending}
                    >
                      Cambiar horario
                    </button>
                    <button
                      type="button"
                      className="sigsam-btn danger small"
                      onClick={() => quitar(dia)}
                      disabled={isPending || dia.tieneHistorial}
                      title={
                        dia.tieneHistorial
                          ? "Tuvo turnos cancelados: se conserva su historial y solo se puede cambiar el horario."
                          : undefined
                      }
                    >
                      Quitar
                    </button>
                  </div>
                ) : null}

                {editando && errorFila && (
                  <div
                    className="sigsam-notice error"
                    role="alert"
                    style={{ flexBasis: "100%", margin: 0 }}
                  >
                    <span className="sigsam-notice-symbol" aria-hidden="true">!</span>
                    <p style={{ margin: 0, fontSize: "14px" }}>{errorFila}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}