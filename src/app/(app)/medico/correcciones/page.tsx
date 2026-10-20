import { requireRole } from "@/lib/auth/guards";
import { obtenerConsultaClinicaTurno } from "@/lib/turnos/consulta-clinica";
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
            ></div>
          )}
        </div>
      </div>
    </>
  );
}
