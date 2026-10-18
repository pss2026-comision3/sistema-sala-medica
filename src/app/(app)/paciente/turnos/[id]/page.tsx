import Link from "next/link";
import { notFound } from "next/navigation";

import { etiquetaFecha } from "@/lib/agenda/reglas";
import { requireRole } from "@/lib/auth/guards";
import { cargarBeneficiarios } from "@/lib/turnos/buscar-horarios";
import { obtenerCitaPaciente } from "@/lib/turnos/consulta-turnos";
import {
  ETIQUETA_ESTADO_CITA,
  ETIQUETA_RESULTADO_ATENCION,
} from "@/lib/agenda/etiquetas";
import type { EstadoTurnoAgenda, ResultadoAgenda } from "@/lib/agenda/tipos";
import { AccionesCancelacion } from "@/components/paciente/CancelarCitaDialog";

export default async function FichaCitaPage(props: {
  params: Promise<{ id: string }>;
}) {
  const sesion = await requireRole("PACIENTE");
  const { id } = await props.params;
  const beneficiarios = await cargarBeneficiarios(BigInt(sesion.usuarioId));

  // CA5 (US-013): la cita solo existe si pertenece a un beneficiario autorizado
  // (el titular o un menor con vínculo de tutor vigente).
  let cita = null;
  for (const beneficiario of beneficiarios) {
    cita = await obtenerCitaPaciente(id, beneficiario.id);
    if (cita) break;
  }
  if (!cita) notFound();

  const cobro =
    cita.situacionCobro === "COBRADA"
      ? "Cobrada"
      : cita.situacionCobro === "SIN_COBRAR"
        ? "Sin cobrar"
        : "Sin cobro al paciente";
  const cobertura =
    cobro === "Sin cobro al paciente" ? "Con cobertura" : "Particular";

  return (
    <div>
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1>Ficha de la cita</h1>
          <p>
            {etiquetaFecha(cita.fecha)} — {cita.hora} hs
          </p>
        </div>
      </div>
      <p>
        <Link href="/paciente/turnos" className="sigsam-link">
          ← Volver a Mis turnos
        </Link>
      </p>
      <section className="sigsam-card">
        <h2>Datos de la cita</h2>
        <p>
          <strong>Beneficiario:</strong> {cita.beneficiarioNombre}
        </p>
        <p>
          <strong>Prestación:</strong> {cita.prestacion}
        </p>
        <p>
          <strong>Tipo:</strong>{" "}
          {cita.tipo === "CONSULTA" ? "Consulta" : "Vacunación"}
        </p>
        <p>
          <strong>Fecha:</strong> {etiquetaFecha(cita.fecha)}
        </p>
        <p>
          <strong>Horario:</strong> {cita.hora} hs
        </p>
        <p>
          <strong>Profesional:</strong> {cita.profesional}
        </p>
        <p>
          <strong>Cobertura:</strong> {cobertura}
        </p>
        <p>
          <strong>Estado:</strong>{" "}
          <span className="sigsam-pill">
            {ETIQUETA_ESTADO_CITA[cita.estado as EstadoTurnoAgenda]}
          </span>
        </p>
        <p>
          <strong>Resultado:</strong>{" "}
          {cita.resultadoVisible ? (
            <span className="sigsam-pill">
              {ETIQUETA_RESULTADO_ATENCION[cita.resultado as ResultadoAgenda]}
            </span>
          ) : (
            "Sin resultado"
          )}
        </p>
      </section>
      {cita.pendienteDeResolver && (
        <section className="sigsam-card" style={{ marginTop: 12 }}>
          <h2>Estado de la jornada</h2>
          <div className="sigsam-notice info">
            <span className="sigsam-notice-symbol">i</span>
            <p style={{ margin: 0 }}>
              Esta cita requiere resolución: la jornada está suspendida.
            </p>
          </div>
          {cita.motivoSuspension && (
            <p style={{ marginTop: 8 }}>
              <strong>Motivo:</strong> {cita.motivoSuspension}
            </p>
          )}
        </section>
      )}
      {(cita.reprogramada || cita.reprogramadoDesdeId) && (
        <section className="sigsam-card" style={{ marginTop: 12 }}>
          <h2>Reprogramación</h2>
          {cita.reprogramadoDesdeId && (
            <p>
              <Link
                href={`/paciente/turnos/${cita.reprogramadoDesdeId}`}
                className="sigsam-link"
              >
                Ver cita original
              </Link>
            </p>
          )}
        </section>
      )}
      <section className="sigsam-card" style={{ marginTop: 12 }}>
        <h2>Cobro</h2>
        <p>
          <strong>Situación:</strong> {cobro}
        </p>
        {cita.facturaDisponible && (
          <Link
            href={`/api/paciente/turnos/${cita.id}/comprobante`}
            download
            className="sigsam-btn secondary"
          >
            Descargar factura
          </Link>
        )}
        {!cita.facturaDisponible && (
          <p>Esta cita no tiene factura disponible.</p>
        )}
      </section>
      <section className="sigsam-card" style={{ marginTop: 12 }}>
        <h2>Acciones</h2>
        <AccionesCancelacion
          cita={{
            id: cita.id,
            beneficiarioNombre: cita.beneficiarioNombre,
            prestacion: cita.prestacion,
            fecha: cita.fecha,
            hora: cita.hora,
            profesional: cita.profesional,
            pendienteDeResolver: cita.pendienteDeResolver,
            motivoSuspension: cita.motivoSuspension,
          }}
          cancelable={cita.cancelable}
          cancelableMotivo={cita.cancelableMotivo}
        />
      </section>
    </div>
  );
}
