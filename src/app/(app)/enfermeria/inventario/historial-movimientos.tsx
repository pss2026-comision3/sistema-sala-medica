import Link from "next/link";
 
import {
  LIMITE_HISTORIAL,
  formatearFechaHoraSala,
  type FiltrosMovimientos,
  type MovimientoHistorial,
} from "@/lib/vacunacion/inventario";
import {
  ETIQUETA_TIPO_MOVIMIENTO,
  TIPOS_MOVIMIENTO,
  cantidadConSigno,
} from "@/lib/vacunacion/inventario-reglas";
 
type OpcionVacuna = {
  id: string;
  nombre: string;
  lotes: { id: string; codigo: string }[];
};
 
type Props = {
  movimientos: MovimientoHistorial[];
  total: number;
  filtros: FiltrosMovimientos;
  opciones: OpcionVacuna[];
  errorFiltros: string | null;
};
 
const celda = { padding: "10px 12px", verticalAlign: "top" } as const;
 
const COLOR_TIPO: Record<
  MovimientoHistorial["tipo"],
  { fondo: string; texto: string }
> = {
  COMPRA: { fondo: "#e9f5ed", texto: "#23613a" },
  APLICACION: { fondo: "#eaf2fb", texto: "#286cb2" },
  AJUSTE: { fondo: "#fff1d9", texto: "#9a5a00" },
};
 
/**
 * CA4: historial de movimientos con cantidad y saldo posterior, filtrable
 * por vacuna, lote, tipo y período. Los filtros viajan en la URL (GET), igual
 * que la agenda médica, así un listado filtrado se puede recargar o compartir.
 */
export function HistorialMovimientos({
  movimientos,
  total,
  filtros,
  opciones,
  errorFiltros,
}: Props) {
  const lotes = opciones.flatMap((vacuna) =>
    vacuna.lotes
      .filter((lote) => !filtros.vacunaId || vacuna.id === filtros.vacunaId)
      .map((lote) => ({ ...lote, vacuna: vacuna.nombre })),
  );
  const hayFiltros = Boolean(
    filtros.vacunaId ||
    filtros.loteId ||
    filtros.tipo ||
    filtros.desde ||
    filtros.hasta,
  );
 
  return (
    <>
      <form
        method="get"
        action="/enfermeria/inventario"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "end",
          marginBottom: 20,
        }}
      >
        <div className="sigsam-field" style={{ flex: "1 1 170px" }}>
          <label htmlFor="filtro-vacuna">Vacuna</label>
          <select
            id="filtro-vacuna"
            name="vacuna"
            defaultValue={filtros.vacunaId ?? ""}
          >
            <option value="">Todas</option>
            {opciones.map((vacuna) => (
              <option key={vacuna.id} value={vacuna.id}>
                {vacuna.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="sigsam-field" style={{ flex: "1 1 170px" }}>
          <label htmlFor="filtro-lote">Lote</label>
          <select
            id="filtro-lote"
            name="lote"
            defaultValue={filtros.loteId ?? ""}
          >
            <option value="">Todos</option>
            {lotes.map((lote) => (
              <option key={lote.id} value={lote.id}>
                {lote.codigo} ({lote.vacuna})
              </option>
            ))}
          </select>
        </div>
        <div className="sigsam-field" style={{ flex: "1 1 170px" }}>
          <label htmlFor="filtro-tipo">Tipo</label>
          <select
            id="filtro-tipo"
            name="tipo"
            defaultValue={filtros.tipo ?? ""}
          >
            <option value="">Todos</option>
            {TIPOS_MOVIMIENTO.map((tipo) => (
              <option key={tipo} value={tipo}>
                {ETIQUETA_TIPO_MOVIMIENTO[tipo]}
              </option>
            ))}
          </select>
        </div>
        <div className="sigsam-field" style={{ flex: "1 1 150px" }}>
          <label htmlFor="filtro-desde">Desde</label>
          <input
            id="filtro-desde"
            name="desde"
            type="date"
            defaultValue={filtros.desde ?? ""}
          />
        </div>
        <div className="sigsam-field" style={{ flex: "1 1 150px" }}>
          <label htmlFor="filtro-hasta">Hasta</label>
          <input
            id="filtro-hasta"
            name="hasta"
            type="date"
            defaultValue={filtros.hasta ?? ""}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" className="sigsam-btn small">
            Filtrar
          </button>
          {hayFiltros && (
            <Link
              href="/enfermeria/inventario"
              className="sigsam-btn ghost small"
            >
              Limpiar
            </Link>
          )}
        </div>
      </form>
 
      {errorFiltros && (
        <div className="sigsam-notice error" role="alert">
          <span className="sigsam-notice-symbol" aria-hidden="true">
            !
          </span>
          <div>
            <strong>Revisá los filtros</strong>
            <p>{errorFiltros}</p>
          </div>
        </div>
      )}
 
      {movimientos.length === 0 ? (
        <div className="sigsam-empty">
          <p>
            {hayFiltros
              ? "No hay movimientos para esos filtros. Probá otro período o criterio."
              : "Todavía no hay movimientos de inventario."}
          </p>
        </div>
      ) : (
        <>
          {total > movimientos.length && (
            <p className="sigsam-muted" style={{ fontSize: 13 }}>
              Se muestran los {LIMITE_HISTORIAL} movimientos más recientes de{" "}
              {total}. Acotá el período o elegí una vacuna para ver el resto.
            </p>
          )}
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: 1020,
                borderCollapse: "collapse",
                textAlign: "left",
                fontSize: 14,
              }}
            >
              <caption className="sr-only">
                Movimientos de inventario con cantidad y saldo posterior.
              </caption>
              <thead>
                <tr
                  style={{
                    borderBottom: "2px solid var(--color-line, #d7e2e4)",
                    color: "var(--color-muted, #52666d)",
                  }}
                >
                  <th scope="col" style={celda}>
                    #
                  </th>
                  <th scope="col" style={celda}>
                    Fecha de registro
                  </th>
                  <th scope="col" style={celda}>
                    Vacuna · Lote
                  </th>
                  <th scope="col" style={celda}>
                    Tipo
                  </th>
                  <th scope="col" style={{ ...celda, textAlign: "right" }}>
                    Cantidad
                  </th>
                  <th scope="col" style={{ ...celda, textAlign: "right" }}>
                    Saldo lote
                  </th>
                  <th scope="col" style={{ ...celda, textAlign: "right" }}>
                    Saldo vacuna
                  </th>
                  <th scope="col" style={celda}>
                    Referencia / motivo
                  </th>
                  <th scope="col" style={celda}>
                    Operador
                  </th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => (
                  <tr
                    key={m.id}
                    id={`movimiento-${m.id}`}
                    style={{
                      borderBottom: "1px solid var(--color-line, #d7e2e4)",
                    }}
                  >
                    <td style={celda}>{m.id}</td>
                    <td style={{ ...celda, whiteSpace: "nowrap" }}>
                      {formatearFechaHoraSala(m.creadoEn)}
                    </td>
                    <td style={celda}>
                      <strong>{m.vacuna}</strong>
                      <span
                        className="sigsam-muted"
                        style={{ display: "block" }}
                      >
                        Lote {m.lote}
                      </span>
                    </td>
                    <td style={celda}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 9px",
                          borderRadius: 999,
                          backgroundColor: COLOR_TIPO[m.tipo].fondo,
                          color: COLOR_TIPO[m.tipo].texto,
                          fontSize: 13,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {ETIQUETA_TIPO_MOVIMIENTO[m.tipo]}
                      </span>
                    </td>
                    <td
                      style={{
                        ...celda,
                        textAlign: "right",
                        fontWeight: 700,
                        color:
                          m.cantidad < 0
                            ? "var(--color-danger)"
                            : "var(--color-success)",
                      }}
                    >
                      {cantidadConSigno(m.cantidad)}
                    </td>
                    <td style={{ ...celda, textAlign: "right" }}>
                      {m.saldoLote}
                    </td>
                    <td style={{ ...celda, textAlign: "right" }}>
                      {m.saldoVacuna}
                    </td>
                    <td style={celda}>
                      {m.motivo ?? "—"}
                      {m.turnoId && (
                        <span
                          className="sigsam-muted"
                          style={{ display: "block", fontSize: 13 }}
                        >
                          Turno de vacunación #{m.turnoId}
                        </span>
                      )}
                      {m.corrigeId && (
                        <span
                          className="sigsam-muted"
                          style={{ display: "block", fontSize: 13 }}
                        >
                          Corrige el movimiento{" "}
                          <a
                            href={`#movimiento-${m.corrigeId}`}
                            className="sigsam-link"
                          >
                            #{m.corrigeId}
                          </a>
                        </span>
                      )}
                      {m.corregidoPor.length > 0 && (
                        <span
                          className="sigsam-muted"
                          style={{ display: "block", fontSize: 13 }}
                        >
                          Corregido por{" "}
                          {m.corregidoPor.map((id, i) => (
                            <span key={id}>
                              {i > 0 && ", "}
                              <a
                                href={`#movimiento-${id}`}
                                className="sigsam-link"
                              >
                                #{id}
                              </a>
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td style={celda}>{m.operador}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}