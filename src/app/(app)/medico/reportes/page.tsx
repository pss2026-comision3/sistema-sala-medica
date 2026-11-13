import { Metadata } from "next";
import { requireRole } from "@/lib/auth/guards";
import { hoySala, sumarDias } from "@/lib/agenda/reglas";
import { consultarReporteAsistencia } from "@/lib/reportes/asistencia-recordatorios";
import { ReportesView } from "../../admin/reportes/reportes-view";

export const metadata: Metadata = {
  title: "Mis reportes | SIGSAM",
  description: "Estadísticas de tus propios turnos.",
};

/**
 * Reportes del Médico (CA5 de US-SIG-034 y US-SIG-035):
 * misma pantalla que administración, pero limitada a sus propios turnos.
 */
export default async function MedicoReportesPage() {
  const sesion = await requireRole("MEDICO");
  const hoy = hoySala();
  const hace30Dias = sumarDias(hoy, -30);

  // El reporte inicial se calcula con rol MEDICO → el servicio fuerza su propio ID.
  const reporteInicial = await consultarReporteAsistencia(
    { desde: hace30Dias, hasta: hoy },
    { usuarioId: sesion.usuarioId, rol: "MEDICO" },
  );

  return (
    <main style={{ paddingBottom: "40px" }}>
      <ReportesView
        medicos={[]}
        especialidades={[]}
        fechaHoy={hoy}
        fechaDesdeDefecto={hace30Dias}
        reporteInicial={reporteInicial}
        modoMedico
      />
    </main>
  );
}