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
import { CancelarCitaButton } from "./cancelar-cita-button";

export default async function FichaCitaPage(props: {
  params: Promise<{ id: string }>;
}) {
  const sesion = await requireRole("PACIENTE");
  const { id } = await props.params;
  const beneficiarios = await cargarBeneficiarios(BigInt(sesion.usuarioId));

  if (beneficiarios.length === 0) {
    notFound();
  }
  const primera = beneficiarios[0].id;
  const cita = await obtenerCitaPaciente(id, primera);
  // También intentamos buscar entre todos si la cita corresponde a otro de sus beneficiarios
  if (!cita) {
    for (const b of beneficiarios) {
      const c = await obtenerCitaPaciente(id, b.id);
      if (c) {
        const nueva = c;
        const cobro =
          nueva.situacionCobro === "COBRADA"
            ? "Cobrada"
            : nueva.situacionCobro === "SIN_COBRAR"
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
                  {etiquetaFecha(nueva.fecha)} · {nueva.hora} hs
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
                <strong>Prestación:</strong> {nueva.prestacion}
              </p>
              <p>
                <strong>Tipo:</strong>{" "}
                {nueva.tipo === "CONSULTA" ? "Consulta" : "Vacunación"}
              </p>
              <p>
                <strong>Fecha:</strong> {etiquetaFecha(nueva.fecha)}
              </p>
              <p>
                <strong>Horario:</strong> {nueva.hora} hs
              </p>
              <p>
                <strong>Profesional:</strong> {nueva.profesional}
              </p>
              <p>
                <strong>Cobertura:</strong> {cobertura}
              </p>
              <p>
                <strong>Estado:</strong>{" "}
                <span className="sigsam-pill">
                  {ETIQUETA_ESTADO_CITA[nueva.estado as EstadoTurnoAgenda]}
                </span>
              </p>
              <p>
                <strong>Resultado:</strong>{" "}
                {nueva.resultadoVisible ? (
                  <span className="sigsam-pill">
                    {
                      ETIQUETA_RESULTADO_ATENCION[
                        nueva.resultado as ResultadoAgenda
                      ]
                    }
                  </span>
                ) : (
                  "Sin resultado"
                )}
              </p>
            </section>
            {nueva.pendienteDeResolver && (
              <section className="sigsam-card" style={{ marginTop: 12 }}>
                <h2>Estado de la jornada</h2>
                <div className="sigsam-notice info">
                  <span className="sigsam-notice-symbol">i</span>
                  <p style={{ margin: 0 }}>
                    Esta cita requiere resolución: la jornada está suspendida.
                  </p>
                </div>
                {nueva.motivoSuspension && (
                  <p style={{ marginTop: 8 }}>
                    <strong>Motivo:</strong> {nueva.motivoSuspension}
                  </p>
                )}
              </section>
            )}
            <section className="sigsam-card" style={{ marginTop: 12 }}>
              <h2>Cobro</h2>
              <p>
                <strong>Situación:</strong> {cobro}
              </p>
              {nueva.facturaDisponible && (
                <Link
                  href={`/api/paciente/turnos/${nueva.id}/comprobante`}
                  download
                  className="sigsam-btn secondary"
                >
                  Descargar factura
                </Link>
              )}
              {!nueva.facturaDisponible && (
                <p>Esta cita no tiene factura disponible.</p>
              )}
            </section>
            <section className="sigsam-card" style={{ marginTop: 12 }}>
              <h2>Acciones</h2>
              {nueva.cancelable ? (
                <CancelarCitaButton turnoId={nueva.id} />
              ) : (
                <div className="sigsam-notice info">
                  <span className="sigsam-notice-symbol">i</span>
                  <p style={{ margin: 0 }}>{nueva.cancelableMotivo}</p>
                </div>
              )}
            </section>
          </div>
        );
      }
    }
    notFound();
  }

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
            {etiquetaFecha(cita.fecha)} · {cita.hora} hs
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
        {cita.cancelable ? (
          <CancelarCitaButton turnoId={cita.id} />
        ) : (
          <div className="sigsam-notice info">
            <span className="sigsam-notice-symbol">i</span>
            <p style={{ margin: 0 }}>{cita.cancelableMotivo}</p>
          </div>
        )}
      </section>
    </div>
  );
}
