import { AgendaMedicaView } from "@/components/agenda/agenda-view";
import { leerFiltrosAgenda } from "@/lib/agenda/reglas";
import {
  listarMedicosAgenda,
  obtenerAgendaMedico,
} from "@/lib/agenda/servicio-agenda";
import { requireRole } from "@/lib/auth/guards";

export default async function AdminAgendaPage(
  props: PageProps<"/admin/agenda">,
) {
  await requireRole("ADMIN");
  const params = await props.searchParams;

  // CA5: administración consulta la agenda de un médico para gestionarla, sin datos clínicos.
  const medicos = await listarMedicosAgenda();
  const pedido = typeof params.medico === "string" ? params.medico : undefined;
  const medicoId = medicos.find((m) => m.id === pedido)?.id ?? medicos[0]?.id;
  if (!medicoId) {
    return (
      <div className="sigsam-empty">
        <p>No hay médicos para consultar.</p>
      </div>
    );
  }

  const filtros = leerFiltrosAgenda(params);
  const dias = await obtenerAgendaMedico({ medicoId, filtros });

  return (
    <>
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1>Agenda de médicos</h1>
          <p>Consulta de agendas para gestión administrativa.</p>
        </div>
      </div>
      <AgendaMedicaView
        dias={dias}
        filtros={filtros}
        basePath="/admin/agenda"
        verFicha={false}
        medicos={medicos}
        medicoSeleccionado={medicoId}
      />
    </>
  );
}
