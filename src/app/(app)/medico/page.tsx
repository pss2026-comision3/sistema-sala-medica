import { AgendaMedicaView } from "@/components/agenda/agenda-view";
import { leerFiltrosAgenda } from "@/lib/agenda/reglas";
import { obtenerAgendaMedico } from "@/lib/agenda/servicio-agenda";
import { requireRole } from "@/lib/auth/guards";

export default async function MedicoAgendaPage(props: PageProps<"/medico">) {
  const sesion = await requireRole("MEDICO");
  const filtros = leerFiltrosAgenda(await props.searchParams);
  // CA2: solo las citas de este médico.
  const dias = await obtenerAgendaMedico({
    medicoId: sesion.usuarioId,
    filtros,
  });

  return (
    <>
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1>Agenda</h1>
          <p>
            Consultá tu agenda del día o del mes y abrí la ficha de tus citas
            confirmadas.
          </p>
        </div>
      </div>
      <AgendaMedicaView
        dias={dias}
        filtros={filtros}
        basePath="/medico"
        verFicha
      />
    </>
  );
}
