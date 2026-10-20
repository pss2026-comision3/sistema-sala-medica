import Link from "next/link";
import { notFound } from "next/navigation";

import { RegistrarAusenciaButton } from "@/components/agenda/RegistrarAusenciaButton";
import {
  ETIQUETA_ESTADO_CITA,
  ETIQUETA_RESULTADO_ATENCION,
} from "@/lib/agenda/etiquetas";
import {
  etiquetaFecha,
  evaluarInicioAtencion,
  evaluarRegistroAusencia,
} from "@/lib/agenda/reglas";
import { obtenerTurnoMedico } from "@/lib/agenda/servicio-agenda";
import { requireRole } from "@/lib/auth/guards";
import { obtenerConsultaClinicaTurno } from "@/lib/turnos/consulta-clinica";
import { ConsultaMedicaForm } from "./consulta-medica-form";
import { ConsultaDetalleView } from "./consulta-detalle-view";

export default async function FichaCitaPage(
  props: PageProps<"/medico/turnos/[id]">,
) {
  const sesion = await requireRole("MEDICO");
  const { id } = await props.params;

  // CA3 y CA5: solo citas propias. Una cita ajena no existe para este médico.
  const encontrado = await obtenerTurnoMedico({
    medicoId: sesion.usuarioId,
    turnoId: id,
  });
  if (!encontrado) notFound();

  const { turno, jornada } = encontrado;
  const confirmada = turno.estado === "CONFIRMADO";
  const inicio = evaluarInicioAtencion(turno, jornada);
  const ausencia = evaluarRegistroAusencia(turno, jornada);

  // Consulta guardada (si existe)
  const consulta = await obtenerConsultaClinicaTurno({
    turnoId: id,
    medicoUsuarioId: sesion.usuarioId,
  });

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

          {/* Sección de resultado de atención (US-016) */}
          <section className="sigsam-card" style={{ marginTop: "16px" }}>
            <h2>Resultado de atención</h2>
            <p>
              <strong>Resultado actual:</strong>{" "}
              <span className="sigsam-pill">
                {ETIQUETA_RESULTADO_ATENCION[turno.resultado]}
              </span>
            </p>
            <RegistrarAusenciaButton
              turnoId={turno.id}
              puede={ausencia.puede}
              motivo={ausencia.motivo}
            />
          </section>

          {/* Sección clínica (US-017) */}
          {consulta ? (
            /* Si ya existe una consulta registrada, se muestra inmutable en solo lectura (CA4) */
            <ConsultaDetalleView
              consulta={{
                ...consulta,
                turnoId: id,
                esAutor: true,
              }}
            />
          ) : inicio.puede ? (
            /* Si la cita cumple las condiciones de CA1 y no está atendida, se ofrece el formulario */
            <ConsultaMedicaForm turnoId={id} />
          ) : (
            /* Si no cumple las condiciones de atención (CA1), se muestra el motivo bloqueante */
            <section className="sigsam-card" style={{ marginTop: "16px" }}>
              <h2>Atención clínica</h2>
              <p>{inicio.motivo}</p>
              <button
                type="button"
                className="sigsam-btn"
                disabled
                style={{ minHeight: "44px" }}
              >
                Iniciar atención
              </button>
            </section>
          )}
        </>
      )}
    </>
  );
}
