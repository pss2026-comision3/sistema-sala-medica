import { RegistrarAusenciaButton } from "@/components/agenda/RegistrarAusenciaButton";
import {
  ETIQUETA_ESTADO_CITA,
  ETIQUETA_RESULTADO_ATENCION,
} from "@/lib/agenda/etiquetas";
import { requireRole } from "@/lib/auth/guards";
import { obtenerTurnosVacunatorioDelDia } from "@/lib/turnos/vacunatorio";

export default async function EnfermeriaInicioPage() {
  const sesion = await requireRole("ENFERMERIA");
  const turnos = await obtenerTurnosVacunatorioDelDia();

  return (
    <>
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1>Hola, {sesion.nombre.split(" ")[0]}</h1>
          <p>
            Registrá las ausencias del vacunatorio del día. La aplicación de
            vacunas (US-025) se incorpora en el Sprint 3.
          </p>
        </div>
      </div>

      <section className="sigsam-card">
        <h2>Vacunatorio de hoy</h2>
        {turnos.length === 0 ? (
          <div className="sigsam-empty">
            <p>
              No hay citas de vacunación para hoy. Las reservas del vacunatorio
              (US-SIG-022 y US-SIG-023) se incorporan en el Sprint 3; en cuanto
              existan, van a aparecer acá para registrar su ausencia.
            </p>
          </div>
        ) : (
          turnos.map((turno) => (
            <div
              key={turno.id}
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 0",
                borderBottom: "1px solid var(--color-border, #e5e7eb)",
              }}
            >
              <div>
                <strong>
                  {turno.hora} hs — {turno.paciente}
                </strong>
                <div className="sigsam-muted" style={{ fontSize: "14px" }}>
                  {turno.vacuna} ·{" "}
                  {ETIQUETA_ESTADO_CITA[turno.estado]} ·{" "}
                  {ETIQUETA_RESULTADO_ATENCION[turno.resultado]}
                </div>
              </div>
              <RegistrarAusenciaButton
                turnoId={turno.id}
                puede={turno.puedeRegistrarAusencia}
                motivo={turno.motivoNoRegistrar}
              />
            </div>
          ))
        )}
      </section>
    </>
  );
}
