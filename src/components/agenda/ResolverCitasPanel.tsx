"use client";

import { X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import {
  buscarDisponibilidadParaReprogramar,
  cancelarCitaAfectada,
  obtenerContextoReprogramacion,
  reprogramarCitaAfectada,
  type CitaPendienteResolucion,
  type DisponibilidadEncontrada,
} from "@/app/actions/resolucion-citas";
import { MOTIVO_MAX, MSG_RESOLUCION } from "@/lib/agenda/resolucion";

/*
 * US-SIG-015 — CA3, CA4 y CA6: resolver individualmente una cita confirmada
 * que quedó afectada por la suspensión de su jornada, cancelándola con
 * motivo o reprogramándola a un horario ya acordado con el paciente.
 *
 * La lista llega por props desde la página: tanto la suspensión (panel de
 * arriba) como cada resolución revalidan `/admin/jornadas`, y así la lista
 * se actualiza sola sin recargar.
 */

type Aviso = { tipo: "exito" | "error"; texto: string } | null;

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

function ErrorInline({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <div
      className="sigsam-notice error"
      role="alert"
      style={{ marginTop: "12px" }}
    >
      <span className="sigsam-notice-symbol" aria-hidden="true">
        !
      </span>
      <p style={{ margin: 0, fontSize: "14px" }}>{texto}</p>
    </div>
  );
}

function Modal({
  titulo,
  subtitulo,
  pendiente,
  onCerrar,
  children,
}: {
  titulo: string;
  subtitulo: string;
  pendiente: boolean;
  onCerrar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={() => !pendiente && onCerrar()}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold" style={{ margin: 0 }}>
              {titulo}
            </h2>
            <p className="sigsam-muted" style={{ margin: "4px 0 0" }}>
              {subtitulo}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            disabled={pendiente}
            aria-label="Cerrar"
            className="p-1 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ResolverCitasPanel({
  citas,
  hoy,
}: {
  citas: CitaPendienteResolucion[];
  hoy: string;
}) {
  const [aviso, setAviso] = useState<Aviso>(null);

  const [citaCancelar, setCitaCancelar] =
    useState<CitaPendienteResolucion | null>(null);
  const [citaReprogramar, setCitaReprogramar] =
    useState<CitaPendienteResolucion | null>(null);

  function alResolver(mensaje: string) {
    setCitaCancelar(null);
    setCitaReprogramar(null);
    setAviso({ tipo: "exito", texto: mensaje });
  }

  return (
    <section className="sigsam-card" style={{ marginTop: "24px" }}>
      <div className="sigsam-eyebrow">Imprevistos</div>
      <h2 style={{ fontSize: "20px", marginBottom: "4px" }}>
        Citas pendientes de resolución
      </h2>
      <p className="sigsam-muted" style={{ fontSize: "14px", marginTop: 0 }}>
        Citas confirmadas de jornadas suspendidas. Cancelalas con un motivo o
        reprogramalas a un horario ya acordado con el paciente fuera del
        sistema. Se puede resolver aunque ya haya pasado el horario original,
        siempre que todavía no tenga un resultado registrado.
      </p>

      <Notice aviso={aviso} />

      {citas.length === 0 ? (
        <div className="sigsam-empty">
          <p>No hay citas pendientes de resolución.</p>
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {citas.map((cita) => (
            <li
              key={cita.id}
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "12px",
                padding: "12px 0",
                borderBottom: "1px solid var(--color-line, #d7e2e4)",
              }}
            >
              <div style={{ flex: "1 1 260px" }}>
                <strong>{cita.fechaLegible}</strong>{" "}
                <span className="sigsam-muted">{cita.hora} hs</span>
                <div style={{ fontSize: "14px" }}>
                  {cita.paciente}{" "}
                  <span className="sigsam-muted">DNI {cita.dni}</span>
                </div>
                <div className="sigsam-muted" style={{ fontSize: "13px" }}>
                  {cita.profesional} · {cita.especialidad}
                </div>
                {cita.motivoSuspension && (
                  <div className="sigsam-muted" style={{ fontSize: "13px" }}>
                    Motivo de la suspensión: {cita.motivoSuspension}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="sigsam-btn secondary small"
                  onClick={() => setCitaReprogramar(cita)}
                >
                  Reprogramar
                </button>
                <button
                  type="button"
                  className="sigsam-btn danger small"
                  onClick={() => setCitaCancelar(cita)}
                >
                  Cancelar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {citaCancelar && (
        <DialogoCancelar
          cita={citaCancelar}
          onCerrar={() => setCitaCancelar(null)}
          onResuelta={alResolver}
        />
      )}
      {citaReprogramar && (
        <DialogoReprogramar
          cita={citaReprogramar}
          hoy={hoy}
          onCerrar={() => setCitaReprogramar(null)}
          onResuelta={alResolver}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// CA3: cancelar con motivo
// ---------------------------------------------------------------------------

function DialogoCancelar({
  cita,
  onCerrar,
  onResuelta,
}: {
  cita: CitaPendienteResolucion;
  onCerrar: () => void;
  onResuelta: (mensaje: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function confirmar() {
    setError(null);
    if (!motivo.trim()) {
      setError(MSG_RESOLUCION.MOTIVO_REQUERIDO);
      return;
    }
    startTransition(async () => {
      const res = await cancelarCitaAfectada({ turnoId: cita.id, motivo });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onResuelta(res.mensaje);
    });
  }

  return (
    <Modal
      titulo="Cancelar cita"
      subtitulo={`${cita.paciente} · ${cita.fechaLegible} ${cita.hora} hs`}
      pendiente={pendiente}
      onCerrar={onCerrar}
    >
      <div className="sigsam-field">
        <label htmlFor="resolucion-motivo">Motivo *</label>
        <textarea
          id="resolucion-motivo"
          rows={3}
          maxLength={MOTIVO_MAX}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Por ejemplo: el paciente no puede asistir en otro horario."
          disabled={pendiente}
          required
        />
        <span className="hint">
          Se le avisa al paciente por email y queda en la bitácora.
        </span>
      </div>

      <ErrorInline texto={error} />

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
          onClick={confirmar}
          disabled={pendiente || !motivo.trim()}
        >
          {pendiente ? "Cancelando…" : "Cancelar cita"}
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// CA4: reprogramar
// ---------------------------------------------------------------------------

function DialogoReprogramar({
  cita,
  hoy,
  onCerrar,
  onResuelta,
}: {
  cita: CitaPendienteResolucion;
  hoy: string;
  onCerrar: () => void;
  onResuelta: (mensaje: string) => void;
}) {
  const [medicos, setMedicos] = useState<
    { id: string; nombre: string }[] | null
  >(null);
  const [medicoId, setMedicoId] = useState("");
  const [fecha, setFecha] = useState("");
  const [disponibilidad, setDisponibilidad] =
    useState<DisponibilidadEncontrada | null>(null);
  const [hora, setHora] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargandoContexto, startCargaContexto] = useTransition();
  const [buscando, startBusqueda] = useTransition();
  const [pendiente, startTransition] = useTransition();

  useEffect(() => {
    startCargaContexto(async () => {
      const res = await obtenerContextoReprogramacion(cita.id);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setMedicos(res.medicos);
      setMedicoId(res.medicoActualId || res.medicos[0]?.id || "");
    });
  }, [cita.id]);

  function buscarJornada() {
    setError(null);
    setDisponibilidad(null);
    setHora("");
    if (!medicoId || !fecha) return;
    startBusqueda(async () => {
      const res = await buscarDisponibilidadParaReprogramar({
        turnoId: cita.id,
        medicoId,
        fecha,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setDisponibilidad(res);
    });
  }

  function confirmar() {
    setError(null);
    if (!disponibilidad || !hora) return;
    startTransition(async () => {
      const res = await reprogramarCitaAfectada({
        turnoId: cita.id,
        nuevaDisponibilidadId: disponibilidad.disponibilidadId,
        nuevaHora: hora,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onResuelta(res.mensaje);
    });
  }

  const pendienteGeneral = pendiente || buscando;

  return (
    <Modal
      titulo="Reprogramar cita"
      subtitulo={`${cita.paciente} · ${cita.fechaLegible} ${cita.hora} hs`}
      pendiente={pendienteGeneral}
      onCerrar={onCerrar}
    >
      {cargandoContexto && medicos === null ? (
        <p className="sigsam-muted">Cargando médicos de la especialidad…</p>
      ) : medicos && medicos.length === 0 ? (
        <p className="sigsam-muted">
          No hay otros médicos activos de {cita.especialidad}.
        </p>
      ) : (
        <>
          <p
            className="sigsam-muted"
            style={{ marginTop: 0, fontSize: "14px" }}
          >
            Cargá el horario ya acordado con el paciente, de la misma
            especialidad ({cita.especialidad}).
          </p>

          <div className="sigsam-field">
            <label htmlFor="reprog-medico">Médico</label>
            <select
              id="reprog-medico"
              value={medicoId}
              onChange={(e) => {
                setMedicoId(e.target.value);
                setDisponibilidad(null);
                setHora("");
              }}
              disabled={pendienteGeneral}
            >
              {(medicos ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="sigsam-field">
            <label htmlFor="reprog-fecha">Fecha</label>
            <input
              id="reprog-fecha"
              type="date"
              value={fecha}
              min={hoy}
              onChange={(e) => {
                setFecha(e.target.value);
                setDisponibilidad(null);
                setHora("");
              }}
              disabled={pendienteGeneral}
            />
          </div>

          <button
            type="button"
            className="sigsam-btn secondary small"
            onClick={buscarJornada}
            disabled={pendienteGeneral || !medicoId || !fecha}
          >
            {buscando ? "Buscando…" : "Buscar jornada publicada"}
          </button>

          {disponibilidad &&
            (disponibilidad.horarios.length === 0 ? (
              <p className="sigsam-muted" style={{ marginTop: "12px" }}>
                No quedan horarios libres en esa jornada (
                {disponibilidad.horaDesde} a {disponibilidad.horaHasta} hs) para
                este paciente.
              </p>
            ) : (
              <div className="sigsam-field" style={{ marginTop: "12px" }}>
                <label htmlFor="reprog-hora">
                  Hora (jornada de {disponibilidad.horaDesde} a{" "}
                  {disponibilidad.horaHasta}, turnos de{" "}
                  {disponibilidad.duracionMin} min)
                </label>
                <select
                  id="reprog-hora"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  disabled={pendienteGeneral}
                >
                  <option value="">Elegí un horario</option>
                  {disponibilidad.horarios.map((h) => (
                    <option key={h} value={h}>
                      {h} hs
                    </option>
                  ))}
                </select>
              </div>
            ))}
        </>
      )}

      <ErrorInline texto={error} />

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          className="sigsam-btn secondary flex-1"
          onClick={onCerrar}
          disabled={pendienteGeneral}
        >
          Volver
        </button>
        <button
          type="button"
          className="sigsam-btn flex-1"
          onClick={confirmar}
          disabled={pendienteGeneral || !disponibilidad || !hora}
        >
          {pendiente ? "Reprogramando…" : "Confirmar nuevo turno"}
        </button>
      </div>
    </Modal>
  );
}
