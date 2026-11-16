"use client";

import { useState } from "react";
import type {
  CategoriaPrestacion,
  ConteoCategoriasPrestacion,
  ResultadoReporteCobertura,
} from "@/lib/reportes/tipos";

interface Props {
  resultado: ResultadoReporteCobertura;
}

const POR_PAGINA = 20;

const th = { padding: "10px 14px", fontWeight: 700 } as const;
const td = { padding: "10px 14px" } as const;

const ETIQUETA_CATEGORIA: Record<CategoriaPrestacion, string> = {
  PARTICULAR: "Particular",
  GRATUITA: "Gratuita",
  CON_COBERTURA: "Con cobertura registrada",
};

const ESTILO_CATEGORIA: Record<
  CategoriaPrestacion,
  { color: string; fondo: string; borde: string }
> = {
  PARTICULAR: { color: "#1f4e79", fondo: "#f3f7fc", borde: "#c9d9ee" },
  GRATUITA: { color: "#1e7e34", fondo: "#f4faf6", borde: "#c3e6cb" },
  CON_COBERTURA: { color: "#0d5c58", fondo: "#f0f7f7", borde: "#cce4e3" },
};

const formatoPesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

function Kpi({
  titulo,
  valor,
  detalle,
  color,
  fondo,
  borde,
}: {
  titulo: string;
  valor: string | number;
  detalle: string;
  color: string;
  fondo: string;
  borde: string;
}) {
  return (
    <div
      style={{
        padding: "16px",
        borderRadius: "8px",
        backgroundColor: fondo,
        border: `1px solid ${borde}`,
      }}
    >
      <div className="sigsam-eyebrow" style={{ color }}>
        {titulo}
      </div>
      <div style={{ fontSize: "28px", fontWeight: 800, color, margin: "4px 0" }}>
        {valor}
      </div>
      <div className="sigsam-muted" style={{ fontSize: "12px" }}>
        {detalle}
      </div>
    </div>
  );
}

function Etiqueta({ categoria }: { categoria: CategoriaPrestacion }) {
  const e = ESTILO_CATEGORIA[categoria];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 700,
        color: e.color,
        backgroundColor: e.fondo,
        border: `1px solid ${e.borde}`,
        whiteSpace: "nowrap",
      }}
    >
      {ETIQUETA_CATEGORIA[categoria]}
    </span>
  );
}

function CeldasConteo({ c }: { c: ConteoCategoriasPrestacion }) {
  return (
    <>
      <td style={{ ...td, fontWeight: 700 }}>{c.total}</td>
      <td style={td}>{c.particular}</td>
      <td style={td}>{c.gratuita}</td>
      <td style={td}>{c.conCobertura}</td>
    </>
  );
}

const estiloTabla = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "14px",
  textAlign: "left",
} as const;

const estiloCabecera = {
  borderBottom: "2px solid var(--color-line)",
  backgroundColor: "#f8fbfb",
} as const;

const estiloFila = { borderBottom: "1px solid var(--color-line)" } as const;

export function VistaCoberturaReporte({ resultado }: Props) {
  const { totales, porMedico, porEntidad, prestaciones, periodo } = resultado;
  const [pagina, setPagina] = useState(1);

  const totalPaginas = Math.max(1, Math.ceil(prestaciones.length / POR_PAGINA));
  const visibles = prestaciones.slice(
    (pagina - 1) * POR_PAGINA,
    pagina * POR_PAGINA,
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
      {/* CA3: resumen de prestaciones atendidas */}
      <section className="sigsam-card">
        <div style={{ marginBottom: "18px" }}>
          <h2 style={{ fontSize: "19px", fontWeight: 700, margin: "0 0 4px" }}>
            Prestaciones atendidas
          </h2>
          <p className="sigsam-muted" style={{ fontSize: "14px", margin: 0 }}>
            Período por fecha de cita: {periodo.desde} al {periodo.hasta}. Solo
            se cuentan las citas con resultado Atendido.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "16px",
          }}
        >
          <Kpi
            titulo="Total atendidas"
            valor={totales.total}
            detalle="Prestaciones del período"
            color="#333"
            fondo="#f8f9fa"
            borde="#dee2e6"
          />
          <Kpi
            titulo="Particular"
            valor={totales.particular}
            detalle="Con arancel a cargo del paciente"
            {...ESTILO_CATEGORIA.PARTICULAR}
          />
          <Kpi
            titulo="Gratuita"
            valor={totales.gratuita}
            detalle="Arancel $0"
            {...ESTILO_CATEGORIA.GRATUITA}
          />
          <Kpi
            titulo="Con cobertura registrada"
            valor={totales.conCobertura}
            detalle="No equivale a un pago recibido"
            {...ESTILO_CATEGORIA.CON_COBERTURA}
          />
        </div>

        {/* CA4: aclaración explícita */}
        <p
          className="sigsam-muted"
          style={{ fontSize: "13px", margin: "16px 0 0", lineHeight: 1.4 }}
        >
          Registrar una cobertura no acredita un ingreso: este reporte no
          contabiliza pagos de las entidades. El arancel que figura en el
          detalle es solo de referencia.
        </p>
      </section>

      {/* CA4: por entidad de cobertura */}
      <section className="sigsam-card">
        <h2 style={{ fontSize: "19px", fontWeight: 700, margin: "0 0 16px" }}>
          Por entidad de cobertura
        </h2>
        {porEntidad.length === 0 ? (
          <div className="sigsam-empty">
            <p>No hay prestaciones con cobertura registrada en el período.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={estiloTabla}>
              <thead>
                <tr style={estiloCabecera}>
                  <th style={th}>Entidad</th>
                  <th style={th}>Prestaciones con cobertura</th>
                </tr>
              </thead>
              <tbody>
                {porEntidad.map((f) => (
                  <tr key={f.id} style={estiloFila}>
                    <td style={{ ...td, fontWeight: 600 }}>{f.nombre}</td>
                    <td style={td}>{f.prestaciones}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Por profesional */}
      <section className="sigsam-card">
        <h2 style={{ fontSize: "19px", fontWeight: 700, margin: "0 0 16px" }}>
          Por profesional
        </h2>
        {porMedico.length === 0 ? (
          <div className="sigsam-empty">
            <p>No hay prestaciones atendidas con los filtros seleccionados.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={estiloTabla}>
              <thead>
                <tr style={estiloCabecera}>
                  <th style={th}>Profesional</th>
                  <th style={th}>Especialidad</th>
                  <th style={th}>Total</th>
                  <th style={th}>Particular</th>
                  <th style={th}>Gratuita</th>
                  <th style={th}>Con cobertura</th>
                </tr>
              </thead>
              <tbody>
                {porMedico.map((f) => (
                  <tr key={f.id} style={estiloFila}>
                    <td style={{ ...td, fontWeight: 600 }}>{f.nombre}</td>
                    <td style={td}>{f.especialidad}</td>
                    <CeldasConteo c={f.conteo} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* CA3: detalle */}
      <section className="sigsam-card">
        <h2 style={{ fontSize: "19px", fontWeight: 700, margin: "0 0 16px" }}>
          Detalle de prestaciones ({prestaciones.length})
        </h2>
        {prestaciones.length === 0 ? (
          <div className="sigsam-empty">
            <p>No hay prestaciones atendidas con los filtros seleccionados.</p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={estiloTabla}>
                <thead>
                  <tr style={estiloCabecera}>
                    <th style={th}>Fecha</th>
                    <th style={th}>Paciente</th>
                    <th style={th}>Profesional</th>
                    <th style={th}>Prestación</th>
                    <th style={th}>Categoría</th>
                    <th style={th}>Cobertura</th>
                    <th style={th}>Arancel (ref.)</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((p) => (
                    <tr key={p.id} style={estiloFila}>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        {p.fecha} {p.hora}
                      </td>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{p.paciente}</div>
                        <div className="sigsam-muted" style={{ fontSize: "12px" }}>
                          DNI {p.dni}
                        </div>
                      </td>
                      <td style={td}>
                        <div>{p.profesional}</div>
                        <div className="sigsam-muted" style={{ fontSize: "12px" }}>
                          {p.especialidad}
                        </div>
                      </td>
                      <td style={td}>{p.prestacion}</td>
                      <td style={td}>
                        <Etiqueta categoria={p.categoria} />
                      </td>
                      <td style={td}>
                        {p.cobertura ? (
                          <>
                            <div>{p.cobertura}</div>
                            {p.plan && (
                              <div
                                className="sigsam-muted"
                                style={{ fontSize: "12px" }}
                              >
                                Plan {p.plan}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="sigsam-muted">—</span>
                        )}
                      </td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        {formatoPesos.format(p.arancelReferencia)}
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
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: "12px",
                  marginTop: "16px",
                }}
              >
                <button
                  type="button"
                  className="sigsam-btn"
                  disabled={pagina === 1}
                  onClick={() => setPagina((p) => p - 1)}
                >
                  Anterior
                </button>
                <span className="sigsam-muted" style={{ fontSize: "14px" }}>
                  Página {pagina} de {totalPaginas}
                </span>
                <button
                  type="button"
                  className="sigsam-btn"
                  disabled={pagina === totalPaginas}
                  onClick={() => setPagina((p) => p + 1)}
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
