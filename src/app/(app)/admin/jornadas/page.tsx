import { listarCitasPendientesDeResolver } from "@/app/actions/resolucion-citas";
import { listarMedicosSuspension } from "@/app/actions/suspension";
import { ResolverCitasPanel } from "@/components/agenda/ResolverCitasPanel";
import { SuspenderJornadaPanel } from "@/components/agenda/suspender-jornada-panel";
import { hoySala } from "@/lib/agenda/reglas";
import { requireRole } from "@/lib/auth/guards";

/**
 * US-009 CA1: Administración puede suspender la jornada de cualquier médico.
 * US-SIG-015 CA3/CA4/CA6: la resolución individual de las citas afectadas
 * (cancelar o reprogramar) se gestiona en `ResolverCitasPanel`, más abajo.
 * Las citas pendientes se cargan acá: al suspender o resolver se revalida
 * esta ruta y la lista llega actualizada sin recargar.
 */
export default async function AdminJornadasPage() {
  await requireRole("ADMIN");
  const [medicos, citasPendientes] = await Promise.all([
    listarMedicosSuspension(),
    listarCitasPendientesDeResolver(),
  ]);

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
      <ResolverCitasPanel citas={citasPendientes} hoy={hoySala()} />
    </>
  );
}
