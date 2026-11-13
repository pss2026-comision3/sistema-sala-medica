"use client";

import type {
  FilaReporteOcupacion,
  ResultadoReporteOcupacion,
} from "@/lib/reportes/tipos";

interface Props {
  resultado: ResultadoReporteOcupacion;
}

const th = { padding: "10px 14px", fontWeight: 700 } as const;
const td = { padding: "10px 14px" } as const;

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

function TablaOcupacion({
  titulo,
  columnaNombre,
  filas,
  mostrarEspecialidad,
}: {
  titulo: string;
  columnaNombre: string;
  filas: FilaReporteOcupacion[];
  mostrarEspecialidad?: boolean;
}) {
  return (
    <section className="sigsam-card">
      <h2 style={{ fontSize: "19px", fontWeight: 700, margin: "0 0 16px" }}>
        {titulo}
      </h2>
      {filas.length === 0 ? (
        <div className="sigsam-empty">
          <p>No hay agendas publicadas en el período y filtros seleccionados.</p>
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
                <th style={th}>{columnaNombre}</th>
                {mostrarEspecialidad && <th style={th}>Especialidad</th>}
                <th style={th}>Ocupación</th>
                <th style={th}>Ocupados / Utilizables</th>
                <th style={th}>Bloqueados</th>
                <th style={th}>Confirmadas</th>
                <th style={th}>Canceladas</th>
                <th style={th}>Atendido</th>
                <th style={th}>Ausente</th>
                <th style={th}>Sin registrar</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} style={{ borderBottom: "1px solid var(--color-line)" }}>
                  <td style={{ ...td, fontWeight: 600 }}>{f.nombre}</td>
                  {mostrarEspecialidad && <td style={td}>{f.especialidad}</td>}
                  <td style={{ ...td, fontWeight: 700 }}>
                    {f.ocupacion.porcentajeOcupacion}
                  </td>
                  <td style={td}>
                    {f.ocupacion.cuposOcupados} / {f.ocupacion.cuposUtilizables}
                  </td>
                  <td style={td}>{f.ocupacion.cuposBloqueados}</td>
                  <td style={td}>{f.reservas.confirmadas}</td>
                  <td style={td}>{f.reservas.canceladas}</td>
                  <td style={td}>{f.reservas.atendidos}</td>
                  <td style={td}>{f.reservas.ausentes}</td>
                  <td style={td}>{f.reservas.sinRegistrar}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function VistaOcupacionReporte({ resultado }: Props) {
  const { ocupacion, reservas, porMedico, porEspecialidad, periodo } = resultado;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px", marginTop: "24px" }}>
      {/* CA3 y CA4: ocupación de cupos */}
      <section className="sigsam-card">
        <div style={{ marginBottom: "18px" }}>
          <h2 style={{ fontSize: "19px", fontWeight: 700, margin: "0 0 4px" }}>
            Ocupación de agenda
          </h2>
          <p className="sigsam-muted" style={{ fontSize: "14px", margin: 0 }}>
            Período: {periodo.desde} al {periodo.hasta}. Los cupos bloqueados por
            jornadas suspendidas no entran en el cálculo.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
          }}
        >
          <Kpi
            titulo="Ocupación"
            valor={ocupacion.porcentajeOcupacion}
            detalle="Cupos con cita confirmada / cupos utilizables"
            color="#0d5c58"
            fondo="#f0f7f7"
            borde="#cce4e3"
          />
          <Kpi
            titulo="Cupos ocupados"
            valor={ocupacion.cuposOcupados}
            detalle="Con al menos una cita confirmada"
            color="#1e7e34"
            fondo="#f4faf6"
            borde="#c3e6cb"
          />
          <Kpi
            titulo="Cupos utilizables"
            valor={ocupacion.cuposUtilizables}
            detalle={`De ${ocupacion.cuposPublicados} cupos publicados`}
            color="#1f4e79"
            fondo="#f3f7fc"
            borde="#c9d9ee"
          />
          <Kpi
            titulo="Cupos bloqueados"
            valor={ocupacion.cuposBloqueados}
            detalle="Jornadas suspendidas (informados aparte)"
            color="#bd2130"
            fondo="#fdf4f4"
            borde="#f5c6cb"
          />
        </div>
      </section>

      {/* CA2: reservas definitivas */}
      <section className="sigsam-card">
        <div style={{ marginBottom: "18px" }}>
          <h2 style={{ fontSize: "19px", fontWeight: 700, margin: "0 0 4px" }}>
            Reservas del período
          </h2>
          <p className="sigsam-muted" style={{ fontSize: "14px", margin: 0 }}>
            Atendido, Ausente y Sin registrar son un desglose de las confirmadas;
            no se suman como reservas adicionales.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "16px",
          }}
        >
          <Kpi titulo="Confirmadas" valor={reservas.confirmadas} detalle="Citas definitivas" color="#0d5c58" fondo="#f0f7f7" borde="#cce4e3" />
          <Kpi titulo="Canceladas" valor={reservas.canceladas} detalle="Citas anuladas" color="#6c757d" fondo="#f6f7f8" borde="#dee2e6" />
          <Kpi titulo="Atendido" valor={reservas.atendidos} detalle="De las confirmadas" color="#1e7e34" fondo="#f4faf6" borde="#c3e6cb" />
          <Kpi titulo="Ausente" valor={reservas.ausentes} detalle="De las confirmadas" color="#bd2130" fondo="#fdf4f4" borde="#f5c6cb" />
          <Kpi titulo="Sin registrar" valor={reservas.sinRegistrar} detalle="De las confirmadas" color="#856404" fondo="#fffbf0" borde="#ffeeba" />
        </div>
      </section>

      <TablaOcupacion
        titulo="Por médico"
        columnaNombre="Médico"
        filas={porMedico}
        mostrarEspecialidad
      />
      <TablaOcupacion
        titulo="Por especialidad"
        columnaNombre="Especialidad"
        filas={porEspecialidad}
      />
    </div>
  );
}