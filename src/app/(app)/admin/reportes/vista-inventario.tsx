"use client";

import { useState } from "react";
import { ZONA_SALA } from "@/lib/agenda/reglas";
import type {
  ResultadoReporteInventario,
  TipoMovimientoReporte,
} from "@/lib/reportes/tipos";
import {
  ETIQUETA_TIPO_MOVIMIENTO,
  cantidadConSigno,
} from "@/lib/vacunacion/inventario-reglas";

interface Props {
  resultado: ResultadoReporteInventario;
}

const TAMANO_PAGINA = 10;

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: ZONA_SALA,
});

const COLOR_TIPO: Record<
  TipoMovimientoReporte,
  { fondo: string; texto: string }
> = {
  COMPRA: { fondo: "#e9f5ed", texto: "#23613a" },
  APLICACION: { fondo: "#eaf2fb", texto: "#286cb2" },
  AJUSTE: { fondo: "#fff1d9", texto: "#9a5a00" },
};

const celda = { padding: "10px 14px", verticalAlign: "top" } as const;

function formatearFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

function formatearFechaHora(iso: string): string {
  return FORMATO_FECHA_HORA.format(new Date(iso));
}

/**
 * US-SIG-036 — Vista del reporte de inventario actual y su evolución.
 *
 * Recortes vigentes (docs/División USs - SPRINT 3.md):
 * - CA1: se muestran físico, umbral y lotes; no comprometido ni disponible.
 * - CA2: el resumen muestra saldo inicial, entradas, ajustes y saldo final.
 *   Las aplicaciones no se muestran como columna, pero sí se incluyen en el
 *   saldo final.
 * - CA4: solo se reconstruye el físico histórico; no se compara con la
 *   situación actual.
 * - CA5: solo lectura, sin datos clínicos y sin exportación (US-SIG-038).
 */
export function VistaInventarioReporte({ resultado }: Props) {
  const { stockActual, resumen, movimientos, periodo } = resultado;

  const [pagina, setPagina] = useState(1);

  const totalMovimientos = movimientos.length;
  const totalPaginas = Math.max(
    1,
    Math.ceil(totalMovimientos / TAMANO_PAGINA),
  );
  const paginaSegura = Math.min(Math.max(1, pagina), totalPaginas);
  const indiceInicio = (paginaSegura - 1) * TAMANO_PAGINA;
  const indiceFin = Math.min(indiceInicio + TAMANO_PAGINA, totalMovimientos);
  const movimientosVisibles = movimientos.slice(indiceInicio, indiceFin);

  const totalDosis = stockActual.reduce(
    (total, vacuna) => total + vacuna.fisico,
    0,
  );
  const vacunasBajoUmbral = stockActual.filter(
    (vacuna) => vacuna.bajoUmbral,
  ).length;
  const lotesTotales = stockActual.reduce(
    (total, vacuna) => total + vacuna.lotes.length,
    0,
  );

  const totalesResumen = resumen.reduce(
    (totales, fila) => ({
      saldoInicial: totales.saldoInicial + fila.saldoInicial,
      entradas: totales.entradas + fila.entradas,
      ajustes: totales.ajustes + fila.ajustes,
      saldoFinal: totales.saldoFinal + fila.saldoFinal,
    }),
    { saldoInicial: 0, entradas: 0, ajustes: 0, saldoFinal: 0 },
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "28px",
        marginTop: "24px",
      }}
    >
      {/* 1. Existencias actuales (CA1 ajustado) */}
      <section className="sigsam-card">
        <div style={{ marginBottom: "18px" }}>
          <h2
            style={{ fontSize: "19px", fontWeight: "700", margin: "0 0 4px" }}
          >
            Existencias actuales
          </h2>
          <p className="sigsam-muted" style={{ fontSize: "14px", margin: 0 }}>
            Stock físico por vacuna y lote. No se muestran comprometidos ni
            disponibles (fuera del alcance del Sprint 3).
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              padding: "16px",
              borderRadius: "8px",
              backgroundColor: "#f0f7f7",
              border: "1px solid #cce4e3",
            }}
          >
            <div className="sigsam-eyebrow" style={{ color: "#0d5c58" }}>
              Vacunas listadas
            </div>
            <div
              style={{
                fontSize: "28px",
                fontWeight: "800",
                color: "#0d5c58",
                margin: "4px 0",
              }}
            >
              {stockActual.length}
            </div>
            <div className="sigsam-muted" style={{ fontSize: "12px" }}>
              Incluye vacunas activas e inactivas
            </div>
          </div>

          <div
            style={{
              padding: "16px",
              borderRadius: "8px",
              backgroundColor: "#f4faf6",
              border: "1px solid #c3e6cb",
            }}
          >
            <div className="sigsam-eyebrow" style={{ color: "#1e7e34" }}>
              Dosis físicas
            </div>
            <div
              style={{
                fontSize: "28px",
                fontWeight: "800",
                color: "#1e7e34",
                margin: "4px 0",
              }}
            >
              {totalDosis}
            </div>
            <div className="sigsam-muted" style={{ fontSize: "12px" }}>
              Suma de los movimientos registrados
            </div>
          </div>

          <div
            style={{
              padding: "16px",
              borderRadius: "8px",
              backgroundColor:
                vacunasBajoUmbral > 0 ? "#fffbf0" : "#fafafa",
              border:
                vacunasBajoUmbral > 0
                  ? "1px solid #ffeeba"
                  : "1px solid #e0e0e0",
            }}
          >
            <div
              className="sigsam-eyebrow"
              style={{
                color:
                  vacunasBajoUmbral > 0 ? "#856404" : "var(--color-muted)",
              }}
            >
              Bajo umbral
            </div>
            <div
              style={{
                fontSize: "28px",
                fontWeight: "800",
                color:
                  vacunasBajoUmbral > 0 ? "#856404" : "var(--color-ink)",
                margin: "4px 0",
              }}
            >
              {vacunasBajoUmbral}
            </div>
            <div className="sigsam-muted" style={{ fontSize: "12px" }}>
              Indicador visual; las alertas son US-SIG-027
            </div>
          </div>
        </div>

        {stockActual.length === 0 ? (
          <div className="sigsam-empty">
            <p>No hay vacunas cargadas para los filtros seleccionados.</p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "14px",
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "2px solid var(--color-line)",
                      backgroundColor: "#f8fbfb",
                    }}
                  >
                    <th style={{ padding: "10px 14px", fontWeight: "700" }}>
                      Vacuna
                    </th>
                    <th style={{ padding: "10px 14px", fontWeight: "700" }}>
                      Estado
                    </th>
                    <th
                      style={{
                        padding: "10px 14px",
                        fontWeight: "700",
                        textAlign: "right",
                      }}
                    >
                      Umbral mínimo
                    </th>
                    <th
                      style={{
                        padding: "10px 14px",
                        fontWeight: "700",
                        textAlign: "right",
                      }}
                    >
                      Físico
                    </th>
                    <th style={{ padding: "10px 14px", fontWeight: "700" }}>
                      Alerta
                    </th>
                    <th
                      style={{
                        padding: "10px 14px",
                        fontWeight: "700",
                        textAlign: "right",
                      }}
                    >
                      Lotes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stockActual.map((vacuna) => (
                    <tr
                      key={vacuna.id}
                      style={{
                        borderBottom: "1px solid var(--color-line)",
                        opacity: vacuna.activa ? 1 : 0.75,
                      }}
                    >
                      <td
                        style={{
                          padding: "10px 14px",
                          fontWeight: "600",
                        }}
                      >
                        {vacuna.nombre}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <EstadoVacunaBadge activa={vacuna.activa} />
                      </td>
                      <td
                        style={{
                          padding: "10px 14px",
                          textAlign: "right",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {vacuna.umbralMinimo}
                      </td>
                      <td
                        style={{
                          padding: "10px 14px",
                          textAlign: "right",
                          fontWeight: "700",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {vacuna.fisico}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {vacuna.bajoUmbral ? (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: "12px",
                              backgroundColor: "#fff3cd",
                              color: "#856404",
                              fontSize: "12px",
                              fontWeight: "600",
                            }}
                          >
                            Bajo umbral
                          </span>
                        ) : (
                          <span className="sigsam-muted">—</span>
                        )}
                      </td>
                      <td
                        style={{
                          padding: "10px 14px",
                          textAlign: "right",
                        }}
                      >
                        {vacuna.lotes.length}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: "#fafafa" }}>
                    <td
                      colSpan={3}
                      style={{
                        padding: "10px 14px",
                        fontWeight: "700",
                        borderTop: "2px solid var(--color-line)",
                      }}
                    >
                      Total
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        textAlign: "right",
                        fontWeight: "800",
                        borderTop: "2px solid var(--color-line)",
                      }}
                    >
                      {totalDosis}
                    </td>
                    <td
                      colSpan={2}
                      style={{
                        padding: "10px 14px",
                        borderTop: "2px solid var(--color-line)",
                      }}
                      className="sigsam-muted"
                    >
                      {lotesTotales} lote{lotesTotales === 1 ? "" : "s"} en total
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <h3
              style={{
                fontSize: "16px",
                fontWeight: "700",
                margin: "24px 0 12px",
              }}
            >
              Desglose por lote
            </h3>

            {lotesTotales === 0 ? (
              <div className="sigsam-empty">
                <p>Las vacunas listadas no tienen lotes registrados.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "14px",
                    textAlign: "left",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: "2px solid var(--color-line)",
                        backgroundColor: "#f8fbfb",
                      }}
                    >
                      <th style={{ padding: "10px 14px", fontWeight: "700" }}>
                        Vacuna
                      </th>
                      <th style={{ padding: "10px 14px", fontWeight: "700" }}>
                        Lote
                      </th>
                      <th style={{ padding: "10px 14px", fontWeight: "700" }}>
                        Vencimiento
                      </th>
                      <th
                        style={{
                          padding: "10px 14px",
                          fontWeight: "700",
                          textAlign: "right",
                        }}
                      >
                        Físico
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockActual.flatMap((vacuna) =>
                      vacuna.lotes.map((lote) => (
                        <tr
                          key={lote.id}
                          style={{
                            borderBottom: "1px solid var(--color-line)",
                          }}
                        >
                          <td style={{ padding: "10px 14px" }}>
                            {vacuna.nombre}
                          </td>
                          <td
                            style={{
                              padding: "10px 14px",
                              fontWeight: "600",
                            }}
                          >
                            {lote.codigo}
                          </td>
                          <td
                            style={{
                              padding: "10px 14px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatearFecha(lote.fechaVencimiento)}
                          </td>
                          <td
                            style={{
                              padding: "10px 14px",
                              textAlign: "right",
                              fontWeight: "700",
                            }}
                          >
                            {lote.fisico}
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <p
          className="sigsam-muted"
          style={{ fontSize: "13px", margin: "16px 0 0" }}
        >
          La exportación a PDF/Excel se incorpora en US-SIG-038.
        </p>
      </section>

      {/* 2. Evolución del período (CA2 y CA3 ajustados) */}
      <section className="sigsam-card">
        <div style={{ marginBottom: "18px" }}>
          <h2
            style={{ fontSize: "19px", fontWeight: "700", margin: "0 0 4px" }}
          >
            Evolución del período
          </h2>
          <p className="sigsam-muted" style={{ fontSize: "14px", margin: 0 }}>
            Período: {formatearFecha(periodo.desde)} al{" "}
            {formatearFecha(periodo.hasta)}. Saldos calculados con los
            movimientos registrados.
          </p>
        </div>

        {resumen.length === 0 ? (
          <div className="sigsam-empty">
            <p>
              No hay saldos ni movimientos para el período y filtros
              seleccionados.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "14px",
                textAlign: "left",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "2px solid var(--color-line)",
                    backgroundColor: "#f8fbfb",
                  }}
                >
                  <th style={{ padding: "10px 14px", fontWeight: "700" }}>
                    Vacuna
                  </th>
                  <th style={{ padding: "10px 14px", fontWeight: "700" }}>
                    Lote
                  </th>
                  <th
                    style={{
                      padding: "10px 14px",
                      fontWeight: "700",
                      textAlign: "right",
                    }}
                  >
                    Saldo inicial
                  </th>
                  <th
                    style={{
                      padding: "10px 14px",
                      fontWeight: "700",
                      textAlign: "right",
                    }}
                  >
                    Entradas
                  </th>
                  <th
                    style={{
                      padding: "10px 14px",
                      fontWeight: "700",
                      textAlign: "right",
                    }}
                  >
                    Ajustes
                  </th>
                  <th
                    style={{
                      padding: "10px 14px",
                      fontWeight: "700",
                      textAlign: "right",
                    }}
                  >
                    Saldo final
                  </th>
                </tr>
              </thead>
              <tbody>
                {resumen.map((fila) => (
                  <tr
                    key={`${fila.vacunaId}-${fila.loteId}`}
                    style={{ borderBottom: "1px solid var(--color-line)" }}
                  >
                    <td style={{ padding: "10px 14px" }}>{fila.vacuna}</td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontWeight: "600",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fila.lote}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        textAlign: "right",
                      }}
                    >
                      {fila.saldoInicial}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        textAlign: "right",
                        color:
                          fila.entradas > 0
                            ? "var(--color-success)"
                            : undefined,
                      }}
                    >
                      {fila.entradas}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        textAlign: "right",
                        color:
                          fila.ajustes !== 0 ? "var(--color-ink)" : undefined,
                      }}
                    >
                      {fila.ajustes}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        textAlign: "right",
                        fontWeight: "700",
                      }}
                    >
                      {fila.saldoFinal}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: "#fafafa" }}>
                  <td
                    colSpan={2}
                    style={{
                      padding: "10px 14px",
                      fontWeight: "700",
                      borderTop: "2px solid var(--color-line)",
                    }}
                  >
                    Total
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      textAlign: "right",
                      fontWeight: "700",
                      borderTop: "2px solid var(--color-line)",
                    }}
                  >
                    {totalesResumen.saldoInicial}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      textAlign: "right",
                      fontWeight: "700",
                      borderTop: "2px solid var(--color-line)",
                    }}
                  >
                    {totalesResumen.entradas}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      textAlign: "right",
                      fontWeight: "700",
                      borderTop: "2px solid var(--color-line)",
                    }}
                  >
                    {totalesResumen.ajustes}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      textAlign: "right",
                      fontWeight: "800",
                      borderTop: "2px solid var(--color-line)",
                    }}
                  >
                    {totalesResumen.saldoFinal}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <p
          className="sigsam-muted"
          style={{ fontSize: "13px", margin: "16px 0 0" }}
        >
          Las aplicaciones no se muestran como columna por el recorte de
          US-SIG-025. Si existieran, están incluidas en el saldo final.
        </p>
      </section>

      {/* 3. Detalle de movimientos (CA2 ajustado) */}
      <section className="sigsam-card">
        <div style={{ marginBottom: "16px" }}>
          <h2
            style={{ fontSize: "19px", fontWeight: "700", margin: "0 0 4px" }}
          >
            Movimientos del período ({totalMovimientos})
          </h2>
          <p className="sigsam-muted" style={{ fontSize: "14px", margin: 0 }}>
            Detalle de movimientos registrados. El filtro de tipo aplica solo a
            esta lista.
          </p>
        </div>

        {totalMovimientos === 0 ? (
          <div className="sigsam-empty">
            <p>
              No se encontraron movimientos en el período y filtros
              seleccionados.
            </p>
          </div>
        ) : (
          <div>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: 1020,
                  borderCollapse: "collapse",
                  fontSize: "14px",
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "2px solid var(--color-line)",
                      backgroundColor: "#f8fbfb",
                    }}
                  >
                    <th style={{ padding: "10px 14px", fontWeight: "700" }}>
                      Fecha y hora
                    </th>
                    <th style={{ padding: "10px 14px", fontWeight: "700" }}>
                      Vacuna
                    </th>
                    <th style={{ padding: "10px 14px", fontWeight: "700" }}>
                      Lote
                    </th>
                    <th style={{ padding: "10px 14px", fontWeight: "700" }}>
                      Tipo
                    </th>
                    <th
                      style={{
                        padding: "10px 14px",
                        fontWeight: "700",
                        textAlign: "right",
                      }}
                    >
                      Cantidad
                    </th>
                    <th style={{ padding: "10px 14px", fontWeight: "700" }}>
                      Motivo
                    </th>
                    <th style={{ padding: "10px 14px", fontWeight: "700" }}>
                      Operador
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {movimientosVisibles.map((movimiento) => (
                    <tr
                      key={movimiento.id}
                      style={{ borderBottom: "1px solid var(--color-line)" }}
                    >
                      <td
                        style={{
                          padding: "10px 14px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatearFechaHora(movimiento.fecha)}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {movimiento.vacuna}
                      </td>
                      <td
                        style={{
                          padding: "10px 14px",
                          fontWeight: "600",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {movimiento.lote}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 9px",
                            borderRadius: "999px",
                            backgroundColor:
                              COLOR_TIPO[movimiento.tipo].fondo,
                            color: COLOR_TIPO[movimiento.tipo].texto,
                            fontSize: "13px",
                            fontWeight: "700",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {ETIQUETA_TIPO_MOVIMIENTO[movimiento.tipo]}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "10px 14px",
                          textAlign: "right",
                          fontWeight: "700",
                          whiteSpace: "nowrap",
                          color:
                            movimiento.cantidad < 0
                              ? "var(--color-danger)"
                              : "var(--color-success)",
                        }}
                      >
                        {cantidadConSigno(movimiento.cantidad)}
                      </td>
                      <td style={celda}>{movimiento.motivo ?? "—"}</td>
                      <td style={{ padding: "10px 14px" }}>
                        {movimiento.operador}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPaginas > 1 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "16px",
                  paddingTop: "14px",
                  borderTop: "1px solid var(--color-line)",
                  fontSize: "13px",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div className="sigsam-muted">
                  Mostrando movimientos <strong>{indiceInicio + 1}</strong> -{" "}
                  <strong>{indiceFin}</strong> de{" "}
                  <strong>{totalMovimientos}</strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <button
                    type="button"
                    disabled={paginaSegura <= 1}
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    className="sigsam-btn secondary small"
                    style={{ padding: "4px 10px", fontSize: "12px" }}
                  >
                    ← Anterior
                  </button>

                  <span style={{ fontWeight: "600", padding: "0 6px" }}>
                    Página {paginaSegura} de {totalPaginas}
                  </span>

                  <button
                    type="button"
                    disabled={paginaSegura >= totalPaginas}
                    onClick={() =>
                      setPagina((p) => Math.min(totalPaginas, p + 1))
                    }
                    className="sigsam-btn secondary small"
                    style={{ padding: "4px 10px", fontSize: "12px" }}
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function EstadoVacunaBadge({ activa }: { activa: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "12px",
        backgroundColor: activa ? "#d4edda" : "#e2e3e5",
        color: activa ? "#155724" : "#383d41",
        fontSize: "12px",
        fontWeight: "600",
      }}
    >
      {activa ? "Activa" : "Inactiva"}
    </span>
  );
}
