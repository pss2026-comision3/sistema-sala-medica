"use client";

import { X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import {
  listarJornadasSuspension,
  previsualizarSuspension,
  suspenderJornada,
  type JornadaListado,
  type MedicoSuspension,
  type PrevisualizacionSuspension,
} from "@/app/actions/suspension";
import { MOTIVO_MAX, MSG_SUSPENSION } from "@/lib/agenda/suspension";

/*
 * US-SIG-009: panel para suspender una jornada ante un imprevisto.
 * - Médico: opera sobre sus propias jornadas (`modo="medico"`).
 * - Administración: elige el médico (`modo="admin"`) y queda registrada como
 *   operadora en la bitácora.
 */

type Props =
  { modo: "medico" } | { modo: "admin"; medicos: MedicoSuspension[] };

type Aviso = { tipo: "exito" | "error"; texto: string } | null;

function formatearInstante(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(iso));
}

function EtiquetaEstado({ jornada }: { jornada: JornadaListado }) {
  const suspendida = jornada.estado === "SUSPENDIDA";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "12px",
        fontSize: "12px",
        fontWeight: 700,
        backgroundColor: suspendida ? "#fcf0f0" : "#e6f4ec",
        color: suspendida ? "#b4393a" : "#176044",
      }}
    >
      {suspendida ? "Suspendida" : "Publicada"}
    </span>
  );
}

function Notice({ aviso }: { aviso: Aviso }) {
  if (!aviso) return null;
  const exito = aviso.tipo === "exito";
  return (
    <div
      className={`sigsam-notice ${exito ? "success" : "error"}`}
      role={exito ? "status" : "alert"}
      style={{ margin: "12px 0" }}
    >
      <span className="sigsam-notice-symbol" aria-hidden="true">
        {exito ? "✓" : "!"}
      </span>
      <p style={{ margin: 0, fontSize: "14px" }}>{aviso.texto}</p>
    </div>
  );
}

export function SuspenderJornadaPanel(props: Props) {
  const esAdmin = props.modo === "admin";
  const medicos = esAdmin ? props.medicos : [];

  const [medicoId, setMedicoId] = useState<string>(medicos[0]?.id ?? "");
  const [jornadas, setJornadas] = useState<JornadaListado[] | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [cargando, startCarga] = useTransition();

  const [previa, setPrevia] = useState<PrevisualizacionSuspension | null>(null);
  const [revisando, startRevision] = useTransition();

  async function cargarJornadas(id: string) {
    const res = await listarJornadasSuspension({
      medicoId: esAdmin ? id : undefined,
    });
    if ("error" in res) {
      setJornadas([]);
      setAviso({ tipo: "error", texto: res.error });
      return;
    }
    setJornadas(res.jornadas);
  }

  // Carga inicial y al cambiar de médico (el estado se actualiza cuando llega
  // la respuesta, igual que en `dias-publicados.tsx`).
  useEffect(() => {
    if (esAdmin && !medicoId) return;
    startCarga(() => cargarJornadas(medicoId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicoId]);

  // CA1: antes de suspender se muestran los horarios afectados.
  function revisar(jornada: JornadaListado) {
    setAviso(null);
    startRevision(async () => {
      const res = await previsualizarSuspension({
        disponibilidadId: jornada.id,
      });
      if ("error" in res) {
        setAviso({ tipo: "error", texto: res.error });
        return;
      }
      setPrevia(res.previsualizacion);
    });
  }

  const proximas = (jornadas ?? []).filter((j) => j.estado === "PUBLICADA");
  const suspendidas = (jornadas ?? []).filter((j) => j.estado === "SUSPENDIDA");

  return (
    <section className="sigsam-card" style={{ marginTop: "24px" }}>
      <div className="sigsam-eyebrow">Imprevistos</div>
      <h2 style={{ fontSize: "20px", marginBottom: "4px" }}>
        Suspender una jornada
      </h2>
      <p className="sigsam-muted" style={{ fontSize: "14px", marginTop: 0 }}>
        La jornada deja de ofrecer turnos y se liberan las retenciones
        temporales. Las citas confirmadas no se cancelan: quedan pendientes de
        resolución administrativa y los pacientes reciben un aviso. Una jornada
        suspendida no se puede reabrir.
      </p>

      {esAdmin && (
        <div className="sigsam-field" style={{ maxWidth: "420px" }}>
          <label htmlFor="suspension-medico">Médico</label>
          {medicos.length === 0 ? (
            <p className="sigsam-muted">No hay médicos activos.</p>
          ) : (
            <select
              id="suspension-medico"
              value={medicoId}
              onChange={(e) => {
                setAviso(null);
                setMedicoId(e.target.value);
              }}
            >
              {medicos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre} ({m.especialidad})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <Notice aviso={aviso} />

      {esAdmin && !medicoId ? null : cargando && jornadas === null ? (
        <p className="sigsam-muted">Cargando jornadas…</p>
      ) : proximas.length === 0 ? (
        <div className="sigsam-empty">
          <p>No hay jornadas publicadas de hoy en adelante.</p>
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {proximas.map((jornada) => (
            <li
              key={jornada.id}
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "12px",
                padding: "12px 0",
                borderBottom: "1px solid var(--color-line, #d7e2e4)",
              }}
            >
              <div style={{ flex: "1 1 240px" }}>
                <strong>{jornada.fechaLegible}</strong>
                <span className="sigsam-muted" style={{ marginLeft: "8px" }}>
                  {jornada.horaDesde} a {jornada.horaHasta} hs
                </span>
                <div style={{ marginTop: "4px", fontSize: "14px" }}>
                  <EtiquetaEstado jornada={jornada} />{" "}
                  <span className="sigsam-muted">
                    {jornada.citasConfirmadas === 0
                      ? "Sin citas confirmadas"
                      : `${jornada.citasConfirmadas} cita(s) confirmada(s)`}
                  </span>
                </div>
              </div>
              {jornada.suspendible ? (
                <button
                  type="button"
                  className="sigsam-btn danger small"
                  onClick={() => revisar(jornada)}
                  disabled={revisando}
                >
                  {revisando ? "Cargando…" : "Suspender jornada"}
                </button>
              ) : (
                <span className="sigsam-muted" style={{ fontSize: "13px" }}>
                  {jornada.motivoNoSuspendible}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {suspendidas.length > 0 && (
        <>
          <h3 style={{ fontSize: "16px", marginTop: "20px" }}>
            Jornadas suspendidas
          </h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {suspendidas.map((jornada) => (
              <li
                key={jornada.id}
                style={{
                  padding: "10px 0",
                  borderBottom: "1px solid var(--color-line, #d7e2e4)",
                  fontSize: "14px",
                }}
              >
                <strong>{jornada.fechaLegible}</strong>{" "}
                <span className="sigsam-muted">
                  {jornada.horaDesde} a {jornada.horaHasta} hs
                </span>{" "}
                <EtiquetaEstado jornada={jornada} />
                <div className="sigsam-muted" style={{ marginTop: "4px" }}>
                  Motivo: {jornada.motivoSuspension}
                  {jornada.suspendidaEn &&
                    ` · ${formatearInstante(jornada.suspendidaEn)}`}
                  {jornada.suspendidaPor && ` · por ${jornada.suspendidaPor}`}
                  {jornada.citasConfirmadas > 0 &&
                    ` · ${jornada.citasConfirmadas} cita(s) pendiente(s) de resolución`}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {previa && (
        <DialogoSuspension
          key={previa.jornada.id}
          previa={previa}
          esAdmin={esAdmin}
          onCerrar={() => setPrevia(null)}
          onSuspendida={(mensaje) => {
            setPrevia(null);
            setAviso({ tipo: "exito", texto: mensaje });
            startCarga(() => cargarJornadas(medicoId));
          }}
          onDesactualizada={(mensaje) => {
            setPrevia(null);
            setAviso({ tipo: "error", texto: mensaje });
            startCarga(() => cargarJornadas(medicoId));
          }}
        />
      )}
    </section>
  );
}

function DialogoSuspension({
  previa,
  esAdmin,
  onCerrar,
  onSuspendida,
  onDesactualizada,
}: {
  previa: PrevisualizacionSuspension;
  esAdmin: boolean;
  onCerrar: () => void;
  onSuspendida: (mensaje: string) => void;
  onDesactualizada: (mensaje: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [confirma, setConfirma] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const { jornada, medico, citasAfectadas } = previa;

  function suspender() {
    setError(null);
    if (!motivo.trim()) {
      setError(MSG_SUSPENSION.MOTIVO_REQUERIDO);
      return;
    }
    if (!confirma) {
      setError(MSG_SUSPENSION.CONFIRMACION_REQUERIDA);
      return;
    }
    startTransition(async () => {
      const res = await suspenderJornada({
        disponibilidadId: jornada.id,
        motivo,
        confirmaHorarios: confirma,
        citasRevisadas: citasAfectadas.map((c) => c.id),
      });
      if ("error" in res) {
        // Si cambiaron los horarios o ya estaba suspendida, se vuelve a la
        // lista para revisar con datos frescos.
        if (
          res.error.startsWith("Los horarios afectados cambiaron") ||
          res.error === MSG_SUSPENSION.JORNADA_YA_SUSPENDIDA
        ) {
          onDesactualizada(res.error);
          return;
        }
        setError(res.error);
        return;
      }
      onSuspendida(res.mensaje);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="suspender-jornada-titulo"
      onClick={() => !pendiente && onCerrar()}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2
              id="suspender-jornada-titulo"
              className="text-lg font-semibold"
              style={{ margin: 0 }}
            >
              Suspender jornada
            </h2>
            <p className="sigsam-muted" style={{ margin: "4px 0 0" }}>
              {medico.nombre} · {medico.especialidad}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            disabled={pendiente}
            className="text-sigsam-text-muted hover:text-sigsam-text p-1 disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ marginTop: 0 }}>
          <strong>{jornada.fechaLegible}</strong> · {jornada.horaDesde} a{" "}
          {jornada.horaHasta} hs
        </p>

        {/* CA1: horarios afectados que se confirman. */}
        <h3 style={{ fontSize: "15px", margin: "16px 0 8px" }}>
          Horarios afectados
        </h3>
        {citasAfectadas.length === 0 ? (
          <p className="sigsam-muted" style={{ marginTop: 0 }}>
            No hay citas confirmadas en esta jornada.
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              border: "1px solid var(--color-line, #d7e2e4)",
              borderRadius: "8px",
            }}
          >
            {citasAfectadas.map((cita, i) => (
              <li
                key={cita.id}
                style={{
                  padding: "8px 12px",
                  borderTop:
                    i === 0 ? "none" : "1px solid var(--color-line, #d7e2e4)",
                  fontSize: "14px",
                }}
              >
                <strong>{cita.hora} hs</strong> — {cita.paciente}{" "}
                <span className="sigsam-muted">DNI {cita.dni}</span>
                {cita.sinDestinatario && (
                  <div style={{ color: "#8a5a00", fontSize: "13px" }}>
                    Sin cuenta activa para recibir el aviso: contactar desde la
                    sala.
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <ul
          className="sigsam-muted"
          style={{ fontSize: "14px", paddingLeft: "18px", margin: "12px 0" }}
        >
          <li>La jornada deja de ofrecer turnos.</li>
          {previa.retencionesALiberar > 0 && (
            <li>
              Se liberan {previa.retencionesALiberar} retención(es) temporal(es)
              en curso.
            </li>
          )}
          {citasAfectadas.length > 0 && (
            <li>
              Las citas confirmadas no se cancelan: quedan pendientes de
              resolución administrativa, se suspenden sus recordatorios y cada
              paciente recibe un email y un aviso interno.
            </li>
          )}
          {previa.citasConResultado > 0 && (
            <li>
              {previa.citasConResultado} cita(s) con resultado ya registrado no
              se modifican.
            </li>
          )}
          {esAdmin && (
            <li>La operación queda registrada a tu nombre como operadora.</li>
          )}
        </ul>

        <div className="sigsam-field">
          <label htmlFor="suspension-motivo">Motivo *</label>
          <textarea
            id="suspension-motivo"
            rows={3}
            maxLength={MOTIVO_MAX}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Por ejemplo: enfermedad del profesional."
            disabled={pendiente}
            required
          />
          <span className="hint">
            Queda registrado en la jornada y en la bitácora.
          </span>
        </div>

        <label
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "flex-start",
            marginTop: "12px",
            fontSize: "14px",
          }}
        >
          <input
            type="checkbox"
            checked={confirma}
            onChange={(e) => setConfirma(e.target.checked)}
            disabled={pendiente}
            style={{ marginTop: "3px" }}
          />
          <span>
            Revisé los horarios afectados y confirmo la suspensión. Entiendo que
            la jornada no se puede reabrir.
          </span>
        </label>

        {error && (
          <div
            className="sigsam-notice error"
            role="alert"
            style={{ marginTop: "12px" }}
          >
            <span className="sigsam-notice-symbol" aria-hidden="true">
              !
            </span>
            <p style={{ margin: 0, fontSize: "14px" }}>{error}</p>
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            className="sigsam-btn secondary flex-1"
            onClick={onCerrar}
            disabled={pendiente}
          >
            Volver
          </button>
          <button
            type="button"
            className="sigsam-btn danger flex-1"
            onClick={suspender}
            disabled={pendiente || !motivo.trim() || !confirma}
          >
            {pendiente ? "Suspendiendo…" : "Suspender jornada"}
          </button>
        </div>
      </div>
    </div>
  );
}
