import Link from "next/link";
import { notFound } from "next/navigation";

import { etiquetaFecha } from "@/lib/agenda/reglas";
import { requireRole } from "@/lib/auth/guards";
import { cargarBeneficiarios } from "@/lib/turnos/buscar-horarios";
import { obtenerCitaPaciente } from "@/lib/turnos/consulta-turnos";
import { obtenerAdjuntosConsultaPaciente } from "@/lib/turnos/adjuntos-clinicos";
import {
  ETIQUETA_ESTADO_CITA,
  ETIQUETA_RESULTADO_ATENCION,
} from "@/lib/agenda/etiquetas";
import type { EstadoTurnoAgenda, ResultadoAgenda } from "@/lib/agenda/tipos";
import { AccionesCancelacion } from "@/components/paciente/CancelarCitaDialog";

function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatearFecha(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function FichaCitaPage(props: {
  params: Promise<{ id: string }>;
}) {
  const sesion = await requireRole("PACIENTE");
  const { id } = await props.params;
  const beneficiarios = await cargarBeneficiarios(BigInt(sesion.usuarioId));

  // CA5 (US-013): la cita solo existe si pertenece a un beneficiario autorizado
  // (el titular o un menor con vínculo de tutor vigente).
  let cita = null;
  let beneficiarioId: string | null = null;
  for (const beneficiario of beneficiarios) {
    cita = await obtenerCitaPaciente(id, beneficiario.id);
    if (cita) {
      beneficiarioId = beneficiario.id;
      break;
    }
  }
  if (!cita) notFound();

  const adjuntos =
    beneficiarioId !== null
      ? await obtenerAdjuntosConsultaPaciente({
          turnoId: id,
          pacientePersonaId: beneficiarioId,
        })
      : [];

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
        <h2>Documentación adjunta</h2>
        {adjuntos.length === 0 ? (
          <p>Esta consulta no tiene documentos adjuntos.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {adjuntos.map((adjunto) => {
              const url = `/api/paciente/turnos/${cita.id}/adjuntos/${adjunto.id}/archivo`;
              return (
                <li
                  key={adjunto.id}
                  style={{
                    borderBottom: "1px solid var(--color-line, #d7e2e4)",
                    padding: "10px 0",
                  }}
                >
                  <p style={{ margin: "0 0 4px" }}>
                    <strong>{adjunto.nombre}</strong>
                  </p>
                  <p
                    className="sigsam-muted"
                    style={{ margin: "0 0 8px", fontSize: "12px" }}
                  >
                    {formatearTamano(adjunto.tamanoBytes)} · Adjuntado el{" "}
                    {formatearFecha(adjunto.creadoEn)}
                  </p>
                  {adjunto.mimeType.startsWith("image/") && (
                    <div style={{ marginBottom: "8px" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={adjunto.nombre}
                        style={{
                          maxWidth: "100%",
                          maxHeight: "240px",
                          borderRadius: "6px",
                          border: "1px solid var(--color-line, #d7e2e4)",
                        }}
                      />
                    </div>
                  )}
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sigsam-link"
                  >
                    Ver archivo
                  </a>
                </li>
              );
            })}
          </ul>
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
