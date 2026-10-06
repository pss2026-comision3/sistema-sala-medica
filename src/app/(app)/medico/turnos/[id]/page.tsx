import Link from "next/link";
import { notFound } from "next/navigation";

import { ETIQUETA_ESTADO_CITA } from "@/lib/agenda/etiquetas";
import { etiquetaFecha, evaluarInicioAtencion } from "@/lib/agenda/reglas";
import { obtenerTurnoMedico } from "@/lib/agenda/servicio-agenda";
import { requireRole } from "@/lib/auth/guards";

export default async function FichaCitaPage(
  props: PageProps<"/medico/turnos/[id]">,
) {
  const sesion = await requireRole("MEDICO");
  const { id } = await props.params;

  // CA3: solo citas propias. Una cita ajena no existe para este médico.
  const encontrado = await obtenerTurnoMedico({
    medicoId: sesion.usuarioId,
    turnoId: id,
  });
  if (!encontrado) notFound();

  const { turno, jornada } = encontrado;
  const confirmada = turno.estado === "CONFIRMADO";
  const inicio = evaluarInicioAtencion(turno, jornada);

  return (
    <>
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1>Ficha de la cita</h1>
          <p>
            {etiquetaFecha(turno.fecha)} · {turno.hora} hs
          </p>
        </div>
      </div>

      <p>
        <Link href="/medico" className="sigsam-link">
          ← Volver a la agenda
        </Link>
      </p>

      {!confirmada && (
        <div className="sigsam-notice info" style={{ marginBottom: "20px" }}>
          <span className="sigsam-notice-symbol" aria-hidden="true">
            i
          </span>
          <div>
            <strong>Sin acceso clínico</strong>
            <p style={{ margin: 0, fontSize: "14px" }}>
              Solo las citas confirmadas dan acceso a la ficha. Esta cita está:{" "}
              {ETIQUETA_ESTADO_CITA[turno.estado]}.
            </p>
          </div>
        </div>
      )}

      {confirmada && (
        <>
          <section className="sigsam-card">
            <h2>Datos generales</h2>
            <p>
              <strong>Paciente:</strong> {turno.paciente.nombre}
            </p>
            <p>
              <strong>DNI:</strong> {turno.paciente.dni}
            </p>
            <p>
              <strong>Cobertura:</strong>{" "}
              {turno.paciente.obraSocial ?? "Particular"}
            </p>
            {turno.pendienteDeResolver && (
              <p style={{ color: "var(--color-warning)", fontWeight: 700 }}>
                Pendiente de resolver: la jornada está suspendida.
              </p>
            )}
          </section>

          <section className="sigsam-card" style={{ marginTop: "16px" }}>
            <h2>Notas clínicas</h2>
            {/* [MOCK-US010] Las notas clínicas se implementan en US-017. */}
            <p className="sigsam-muted">Disponibles al implementar US-017.</p>
          </section>

          <section className="sigsam-card" style={{ marginTop: "16px" }}>
            <h2>Iniciar atención</h2>
            <p>
              {inicio.puede
                ? "La cita cumple las condiciones para iniciar la atención."
                : inicio.motivo}
            </p>
            {/* [MOCK-US010] El inicio real de la atención se implementa en US-017. */}
            <button type="button" className="sigsam-btn" disabled>
              Iniciar atención
            </button>
            <p className="sigsam-muted" style={{ marginTop: "8px" }}>
              Se habilita al implementar US-017.
            </p>
          </section>
        </>
      )}
    </>
  );
}
