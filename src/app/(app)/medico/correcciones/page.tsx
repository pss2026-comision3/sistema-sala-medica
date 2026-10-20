import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { obtenerConsultaClinicaTurno } from "@/lib/turnos/consulta-clinica";
import { ConsultaDetalleView } from "../turnos/[id]/consulta-detalle-view";
import { obtenerResumenConsultasMedico } from "@/app/actions/consultas";

export default async function CorreccionesPage(props: {
  searchParams: Promise<{ turnoId?: string }>;
}) {
  const sesion = await requireRole("MEDICO");
  const searchParams = await props.searchParams;

  const historial = await obtenerResumenConsultasMedico(
    sesion.usuarioId.toString(),
  );

  let consultaDetalle = null;
  if (searchParams.turnoId) {
    consultaDetalle = await obtenerConsultaClinicaTurno({
      turnoId: searchParams.turnoId,
      medicoUsuarioId: sesion.usuarioId.toString(),
    });
  }

  return (
    <>
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1>Historial y Correcciones</h1>
          <p>Buscá consultas pasadas para revisar o agregar aclaraciones.</p>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "24px",
          alignItems: "flex-start",
          marginTop: "20px",
        }}
      >
        <div
          className="sigsam-card"
          style={{
            flex: "0 0 320px",
            padding: "16px",
            maxHeight: "calc(100vh - 200px)",
            overflowY: "auto",
          }}
        >
          <h2 style={{ fontSize: "16px", marginBottom: "16px" }}>
            Tus Consultas ({historial.length})
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {historial.length === 0 ? (
              <p className="sigsam-muted" style={{ fontSize: "14px" }}>
                No tenés consultas registradas todavía.
              </p>
            ) : (
              historial.map((item) => {
                const seleccionado = item.turnoId === searchParams.turnoId;

                return (
                  <Link
                    key={item.turnoId}
                    href={`/medico/correcciones?turnoId=${item.turnoId}`}
                    style={{
                      display: "block",
                      padding: "12px",
                      borderRadius: "6px",
                      textDecoration: "none",
                      border: "1px solid",
                      borderColor: seleccionado
                        ? "#1b6338"
                        : "var(--color-line, #d7e2e4)",
                      backgroundColor: seleccionado ? "#edf7f1" : "transparent",
                      transition: "all 0.2s",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        color: "var(--color-ink, #18323a)",
                        fontSize: "14px",
                      }}
                    >
                      {item.pacienteNombre}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--color-muted, #5f747a)",
                        marginTop: "4px",
                      }}
                    >
                      DNI: {item.pacienteDni}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--color-muted, #5f747a)",
                        marginTop: "2px",
                      }}
                    >
                      {new Date(item.creadaEn).toLocaleDateString("es-AR")}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        <div style={{ flex: "1" }}>
          {consultaDetalle ? (
            <ConsultaDetalleView
              consulta={{
                ...consultaDetalle,
                turnoId: searchParams.turnoId as string,
                esAutor: true,
              }}
            />
          ) : (
            <div
              className="sigsam-card"
              style={{
                display: "grid",
                placeItems: "center",
                minHeight: "300px",
                textAlign: "center",
                backgroundColor: "#f9fafa",
              }}
            >
              <div>
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-muted, #5f747a)"
                  strokeWidth="1.5"
                  style={{ marginBottom: "16px" }}
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <h2
                  style={{
                    fontSize: "18px",
                    color: "var(--color-ink, #18323a)",
                  }}
                >
                  Ninguna consulta seleccionada
                </h2>
                <p className="sigsam-muted" style={{ marginTop: "8px" }}>
                  Elegí un paciente de la lista de la izquierda para ver su
                  historial <br /> y agregar correcciones.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
