import { Metadata } from "next";
import { requireRole } from "@/lib/auth/guards";
import { hoySala, sumarDias } from "@/lib/agenda/reglas";
import {
  consultarReporteAsistencia,
  obtenerEspecialidadesParaFiltro,
  obtenerMedicosParaFiltro,
} from "@/lib/reportes/asistencia-recordatorios";
import { ReportesView } from "./reportes-view";

export const metadata: Metadata = {
  title: "Reportes | SIGSAM",
  description:
    "Reportes administrativos de asistencia, ausentismo y recordatorios.",
};

/*
 * Para agregar un nuevo tipo de reporte chequear Guia para agregar nuevos reportes
 * (Esta en esta mismo directorio de reportes)
 */

export default async function AdminReportesPage() {
  const sesion = await requireRole("ADMIN");
  const hoy = hoySala();
  const hace30Dias = sumarDias(hoy, -30);

  const [medicos, especialidades, reporteInicial] = await Promise.all([
    obtenerMedicosParaFiltro(),
    obtenerEspecialidadesParaFiltro(),
    consultarReporteAsistencia(
      { desde: hace30Dias, hasta: hoy },
      { usuarioId: sesion.usuarioId, rol: "ADMIN" },
    ),
  ]);

  return (
    <main style={{ paddingBottom: "40px" }}>
      <ReportesView
        medicos={medicos}
        especialidades={especialidades}
        fechaHoy={hoy}
        fechaDesdeDefecto={hace30Dias}
        reporteInicial={reporteInicial}
      />
    </main>
  );
}
