"use client";

import { useEffect, useState, useTransition } from "react";

import {
  buscarJornadaPresencial,
  buscarPacientesPresencial,
  cancelarCitaPresencial,
  listarCatalogoMedicoPresencial,
  listarCitasVigentesPaciente,
  reservarCitaPresencial,
  type CitaVigentePaciente,
  type JornadaEncontrada,
  type PacienteEncontrado,
} from "@/app/actions/reservas-presenciales";

/*
 * US-SIG-015 — CA1 y CA2: Médico, Enfermería y Administración reservan o
 * cancelan una cita médica presencial para un paciente existente y
 * habilitado, eligiendo entre los horarios libres que calcula el servidor
 * (cupos, superposiciones y límite de un turno vigente por especialidad). No
 * incluye vacunación: depende de la agenda del vacunatorio (US-SIG-022/023).
 */

type Aviso = { tipo: "exito" | "error"; texto: string } | null;
type Catalogo = {
  id: string;
  nombre: string;
  medicos: { id: string; nombre: string }[];
}[];

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

export function ReservarCitaPresencialPanel({ hoy }: { hoy: string }) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<PacienteEncontrado[] | null>(
    null,
  );
  const [paciente, setPaciente] = useState<PacienteEncontrado | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [buscando, startBusqueda] = useTransition();
  // Cambia con cada reserva para que la lista de citas vigentes se recargue.
  const [version, setVersion] = useState(0);

  function buscarPaciente() {
    setAviso(null);
    if (query.trim().length < 2) {
      setResultados([]);
      return;
    }
    startBusqueda(async () => {
      const res = await buscarPacientesPresencial(query);
      setResultados(res);
    });
  }

  return (
    <section className="sigsam-card" style={{ marginTop: "24px" }}>
      <div className="sigsam-eyebrow">Atención presencial</div>
      <h2 style={{ fontSize: "20px", marginBottom: "4px" }}>Elegir paciente</h2>
      <p className="sigsam-muted" style={{ fontSize: "14px", marginTop: 0 }}>
        Buscá al paciente por nombre o DNI para reservarle o cancelarle un
        turno.
      </p>

      <Notice aviso={aviso} />

      {!paciente ? (
        <>
          <div className="sigsam-field" style={{ maxWidth: "420px" }}>
            <label htmlFor="buscar-paciente">Nombre o DNI</label>
            <input
              id="buscar-paciente"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  buscarPaciente();
                }
              }}
              placeholder="Ej: Pérez o 30123456"
            />
          </div>
          <button
            type="button"
            className="sigsam-btn secondary small"
            onClick={buscarPaciente}
            disabled={buscando || query.trim().length < 2}
          >
            {buscando ? "Buscando…" : "Buscar"}
          </button>

          {resultados !== null &&
            (resultados.length === 0 ? (
              <p className="sigsam-muted" style={{ marginTop: "12px" }}>
                No se encontraron pacientes.
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0 }}>
                {resultados.map((p) => (
                  <li
                    key={p.id}
                    style={{
                      padding: "8px 0",
                      borderTop: "1px solid var(--color-line, #d7e2e4)",
                    }}
                  >
                    <button
                      type="button"
                      className="sigsam-btn ghost small"
                      onClick={() => {
                        setPaciente(p);
                        setResultados(null);
                        setQuery("");
                      }}
                    >
                      {p.nombre} — DNI {p.dni}
                    </button>
                    {!p.habilitado && (
                      <span
                        className="sigsam-muted"
                        style={{ fontSize: "13px", marginLeft: "8px" }}
                      >
                        · No habilitado: {p.motivoNoHabilitado}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ))}
        </>
      ) : (
        <div style={{ marginTop: "8px" }}>
          <p>
            <strong>{paciente.nombre}</strong>{" "}
            <span className="sigsam-muted">DNI {paciente.dni}</span>{" "}
            <button
              type="button"
              className="sigsam-btn ghost small"
              onClick={() => {
                setPaciente(null);
                setAviso(null);
              }}
            >
              Cambiar paciente
            </button>
          </p>

          {paciente.habilitado ? (
            <ReservarSeccion
              pacienteId={paciente.id}
              hoy={hoy}
              onAviso={setAviso}
              onReservado={() => setVersion((v) => v + 1)}
            />
          ) : (
            <section className="sigsam-card" style={{ marginTop: "16px" }}>
              <h3 style={{ fontSize: "16px", marginTop: 0 }}>
                Reservar una cita médica
              </h3>
              <ErrorInline
                texto={`No se puede reservar: ${paciente.motivoNoHabilitado}`}
              />
            </section>
          )}
          <CancelarSeccion
            pacienteId={paciente.id}
            version={version}
            onAviso={setAviso}
          />
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// CA1: reservar una cita médica
// ---------------------------------------------------------------------------

function ReservarSeccion({
  pacienteId,
  hoy,
  onAviso,
  onReservado,
}: {
  pacienteId: string;
  hoy: string;
  onAviso: (a: Aviso) => void;
  onReservado: () => void;
}) {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [especialidadId, setEspecialidadId] = useState("");
  const [medicoId, setMedicoId] = useState("");
  const [fecha, setFecha] = useState("");
  const [jornada, setJornada] = useState<JornadaEncontrada | null>(null);
  const [hora, setHora] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargandoCatalogo, startCargaCatalogo] = useTransition();
  const [buscandoJornada, startBusquedaJornada] = useTransition();
  const [reservando, startReserva] = useTransition();

  useEffect(() => {
    startCargaCatalogo(async () => {
      const res = await listarCatalogoMedicoPresencial();
      setCatalogo(res);
      if (res[0]) {
        setEspecialidadId(res[0].id);
        setMedicoId(res[0].medicos[0]?.id ?? "");
      }
    });
  }, []);

  const especialidadActual = catalogo?.find((e) => e.id === especialidadId);
  const pendiente = cargandoCatalogo || buscandoJornada || reservando;

  function cambiarEspecialidad(id: string) {
    setEspecialidadId(id);
    const esp = catalogo?.find((e) => e.id === id);
    setMedicoId(esp?.medicos[0]?.id ?? "");
    setJornada(null);
    setHora("");
  }

  function buscarJornada() {
    setError(null);
    setJornada(null);
    setHora("");
    if (!medicoId || !fecha) return;
    startBusquedaJornada(async () => {
      const res = await buscarJornadaPresencial({
        pacienteId,
        medicoId,
        fecha,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setJornada(res);
    });
  }

  function reservar() {
    setError(null);
    if (!jornada || !hora) return;
    startReserva(async () => {
      const res = await reservarCitaPresencial({
        pacienteId,
        disponibilidadId: jornada.disponibilidadId,
        hora,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onAviso({ tipo: "exito", texto: res.mensaje });
      onReservado();
      setJornada(null);
      setHora("");
      setFecha("");
    });
  }

  return (
    <section className="sigsam-card" style={{ marginTop: "16px" }}>
      <h3 style={{ fontSize: "16px", marginTop: 0 }}>
        Reservar una cita médica
      </h3>

      {cargandoCatalogo && !catalogo ? (
        <p className="sigsam-muted">Cargando especialidades…</p>
      ) : !catalogo || catalogo.length === 0 ? (
        <p className="sigsam-muted">No hay médicos activos.</p>
      ) : (
        <>
          <div className="sigsam-field">
            <label htmlFor="reserva-especialidad">Especialidad</label>
            <select
              id="reserva-especialidad"
              value={especialidadId}
              onChange={(e) => cambiarEspecialidad(e.target.value)}
              disabled={pendiente}
            >
              {catalogo.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="sigsam-field">
            <label htmlFor="reserva-medico">Médico</label>
            <select
              id="reserva-medico"
              value={medicoId}
              onChange={(e) => {
                setMedicoId(e.target.value);
                setJornada(null);
                setHora("");
              }}
              disabled={pendiente}
            >
              {(especialidadActual?.medicos ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="sigsam-field">
            <label htmlFor="reserva-fecha">Fecha</label>
            <input
              id="reserva-fecha"
              type="date"
              value={fecha}
              min={hoy}
              onChange={(e) => {
                setFecha(e.target.value);
                setJornada(null);
                setHora("");
              }}
              disabled={pendiente}
            />
          </div>

          <button
            type="button"
            className="sigsam-btn secondary small"
            onClick={buscarJornada}
            disabled={pendiente || !medicoId || !fecha}
          >
            {buscandoJornada ? "Buscando…" : "Buscar jornada publicada"}
          </button>

          {jornada &&
            (jornada.horarios.length === 0 ? (
              <p className="sigsam-muted" style={{ marginTop: "12px" }}>
                No quedan horarios libres en esa fecha para este paciente
                (jornada de {jornada.horaDesde} a {jornada.horaHasta} hs).
              </p>
            ) : (
              <div className="sigsam-field" style={{ marginTop: "12px" }}>
                <label htmlFor="reserva-hora">
                  Hora (jornada de {jornada.horaDesde} a {jornada.horaHasta},
                  turnos de {jornada.duracionMin} min)
                </label>
                <select
                  id="reserva-hora"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  disabled={pendiente}
                >
                  <option value="">Elegí un horario</option>
                  {jornada.horarios.map((h) => (
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

      <div className="mt-4">
        <button
          type="button"
          className="sigsam-btn"
          onClick={reservar}
          disabled={pendiente || !jornada || !hora}
        >
          {reservando ? "Reservando…" : "Confirmar reserva"}
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// CA2: cancelar una cita vigente, hasta antes del inicio
// ---------------------------------------------------------------------------

function CancelarSeccion({
  pacienteId,
  version,
  onAviso,
}: {
  pacienteId: string;
  version: number;
  onAviso: (a: Aviso) => void;
}) {
  const [citas, setCitas] = useState<CitaVigentePaciente[] | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, startCarga] = useTransition();
  const [cancelando, startCancelacion] = useTransition();

  async function cargar() {
    const res = await listarCitasVigentesPaciente(pacienteId);
    setCitas(res);
  }

  useEffect(() => {
    startCarga(cargar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId, version]);

  function cancelar(turnoId: string) {
    setError(null);
    startCancelacion(async () => {
      const res = await cancelarCitaPresencial({ turnoId });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setConfirmandoId(null);
      onAviso({ tipo: "exito", texto: res.mensaje });
      startCarga(cargar);
    });
  }

  return (
    <section className="sigsam-card" style={{ marginTop: "16px" }}>
      <h3 style={{ fontSize: "16px", marginTop: 0 }}>
        Cancelar una cita vigente
      </h3>

      {cargando && citas === null ? (
        <p className="sigsam-muted">Cargando…</p>
      ) : !citas || citas.length === 0 ? (
        <p className="sigsam-muted">Este paciente no tiene citas vigentes.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {citas.map((c) => (
            <li
              key={c.id}
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "12px",
                padding: "10px 0",
                borderTop: "1px solid var(--color-line, #d7e2e4)",
              }}
            >
              <div style={{ flex: "1 1 220px", fontSize: "14px" }}>
                <strong>{c.fechaLegible}</strong>{" "}
                <span className="sigsam-muted">{c.hora} hs</span>
                <div className="sigsam-muted">
                  {c.profesional} · {c.especialidad}
                </div>
              </div>
              {c.pendienteResolucion ? (
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    fontSize: "12px",
                    fontWeight: 700,
                    backgroundColor: "#fcf0f0",
                    color: "#b4393a",
                  }}
                >
                  Jornada suspendida · la resuelve Administración en Jornadas
                </span>
              ) : confirmandoId === c.id ? (
                <div
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  <span style={{ fontSize: "13px" }}>¿Cancelar esta cita?</span>
                  <button
                    type="button"
                    className="sigsam-btn danger small"
                    onClick={() => cancelar(c.id)}
                    disabled={cancelando}
                  >
                    {cancelando ? "Cancelando…" : "Sí, cancelar"}
                  </button>
                  <button
                    type="button"
                    className="sigsam-btn secondary small"
                    onClick={() => setConfirmandoId(null)}
                    disabled={cancelando}
                  >
                    Volver
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="sigsam-btn danger small"
                  onClick={() => setConfirmandoId(c.id)}
                >
                  Cancelar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ErrorInline texto={error} />
    </section>
  );
}
