import { listarMedicosSuspension } from "@/app/actions/suspension";
import { SuspenderJornadaPanel } from "@/components/agenda/suspender-jornada-panel";
import { requireRole } from "@/lib/auth/guards";

/**
 * US-009 CA1: Administración puede suspender la jornada de cualquier médico.
 * La resolución de las citas afectadas (cancelar o reprogramar) es de US-015.
 */
export default async function AdminJornadasPage() {
  await requireRole("ADMIN");
  const medicos = await listarMedicosSuspension();

  return (
    <>
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1>Jornadas médicas</h1>
          <p>
            Suspendé la jornada de un médico ante un imprevisto. Las citas
            confirmadas quedan pendientes de resolución individual.
          </p>
        </div>
      </div>

      <SuspenderJornadaPanel modo="admin" medicos={medicos} />
    </>
  );
}
