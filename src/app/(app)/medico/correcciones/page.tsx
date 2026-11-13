import { requireRole } from "@/lib/auth/guards";
import { obtenerConsultaClinicaTurno } from "@/lib/turnos/consulta-clinica";
import {
  obtenerAdjuntosConsultaTurno,
  type AdjuntoClinicoViewData,
} from "@/lib/turnos/adjuntos-clinicos";
import { ConsultaDetalleView } from "../turnos/[id]/consulta-detalle-view";
import { obtenerResumenConsultasMedico } from "@/app/actions/consultas";
import { HistorialSidebar } from "@/components/medico/historial-sidebar";

export default async function CorreccionesPage(props: {
  searchParams: Promise<{ turnoId?: string }>;
}) {
  const sesion = await requireRole("MEDICO");
  const searchParams = await props.searchParams;

  const historial = await obtenerResumenConsultasMedico(
    sesion.usuarioId.toString(),
  );

  let consultaDetalle = null;
  let adjuntos: AdjuntoClinicoViewData[] = [];
  if (searchParams.turnoId) {
    const [detalle, adj] = await Promise.all([
      obtenerConsultaClinicaTurno({
        turnoId: searchParams.turnoId,
        medicoUsuarioId: sesion.usuarioId.toString(),
      }),
      obtenerAdjuntosConsultaTurno({
        turnoId: searchParams.turnoId,
        medicoUsuarioId: sesion.usuarioId.toString(),
      }),
    ]);
    consultaDetalle = detalle;
    adjuntos = adj ?? [];
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
        <HistorialSidebar
          historial={historial}
          turnoSeleccionadoId={searchParams.turnoId}
        />

        <div style={{ flex: "1" }}>
          {consultaDetalle ? (
            <ConsultaDetalleView
              consulta={{
                ...consultaDetalle,
                turnoId: searchParams.turnoId as string,
                esAutor: true,
              }}
              adjuntos={adjuntos}
              turnoId={searchParams.turnoId as string}
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
                padding: "32px",
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: "18px",
                    color: "var(--color-ink, #18323a)",
                    marginBottom: "8px",
                  }}
                >
                  Ninguna consulta seleccionada
                </h3>
                <p className="sigsam-muted" style={{ margin: 0 }}>
                  Elegí una consulta de la lista de la izquierda para revisar sus
                  detalles y agregar correcciones.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
