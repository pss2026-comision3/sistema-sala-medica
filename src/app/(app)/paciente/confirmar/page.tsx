"use client";

import {
  useState,
  useEffect,
  use,
  startTransition,
  useCallback,
  useRef,
} from "react";
import { useActionState } from "react";
import {
  reservarTurnoTemporal,
  cancelarReserva,
  type ResultadoReserva,
} from "@/app/actions/reservas";
import {
  obtenerMisPacientes,
  type MiPaciente,
} from "@/app/actions/mis-pacientes";
import { TurnoDetalleCard } from "@/components/paciente/TurnoDetalleCard";
import { CountdownRetencion } from "@/components/paciente/CountdownRetencion";
import { ConfirmarReservaDialog } from "@/components/paciente/ConfirmarReservaDialog";
import { ReservaExitosaToast } from "@/components/paciente/ReservaExitosaToast";

// Type guard para discriminated union
function esExitoReserva(
  r: ResultadoReserva,
): r is { exito: true; turnoId: string; retenidoHasta: Date } {
  return "exito" in r && r.exito === true;
}

type EstadoPagina =
  "SELECCION" | "RESERVADO" | "CONFIRMADO" | "EXPIRADO" | "ERROR";

interface SearchParams {
  disponibilidadId?: string;
  hora?: string;
  medico?: string;
  especialidad?: string;
  fecha?: string;
  duracionMin?: string;
  arancel?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

// Componente interno que usa use(searchParams) - requiere React 19
function ConfirmarContenido({ searchParams }: PageProps) {
  const params = use(searchParams) as SearchParams;

  const {
    disponibilidadId,
    hora,
    medico,
    especialidad,
    fecha,
    duracionMin,
    arancel,
  } = params;

  const [estado, setEstado] = useState<EstadoPagina>("SELECCION");
  const [turnoId, setTurnoId] = useState<string>();
  const [retenidoHasta, setRetenidoHasta] = useState<Date>();
  const [mostrarToast, setMostrarToast] = useState(false);
  const [pacienteId, setPacienteId] = useState<string>("");
  const [pacientes, setPacientes] = useState<MiPaciente[]>([]);
  const [cargandoPacientes, setCargandoPacientes] = useState(true);
  const [errorParams, setErrorParams] = useState<string | null>(null);

  // Ref para trackear qué resultado ya procesamos (evita re-procesar al cambiar estado)
  const processedReservaRef = useRef<string | undefined>(undefined);

  // ✅ Validar params requeridos EN useEffect (no durante render)
  useEffect(() => {
    if (
      !disponibilidadId ||
      !hora ||
      !medico ||
      !especialidad ||
      !fecha ||
      !duracionMin ||
      !arancel
    ) {
      setErrorParams(
        "Faltan datos del turno. Volvé a buscar y elegí un horario.",
      );
    } else {
      setErrorParams(null);
    }
  }, [
    disponibilidadId,
    hora,
    medico,
    especialidad,
    fecha,
    duracionMin,
    arancel,
  ]);

  // Cargar pacientes del usuario logueado
  useEffect(() => {
    obtenerMisPacientes()
      .then((data) => {
        setPacientes(data);
        setCargandoPacientes(false);
      })
      .catch(() => {
        setCargandoPacientes(false);
        setErrorParams("No se pudieron cargar tus pacientes.");
      });
  }, []);

  // Server Action: reservar turno temporal
  const [resultadoReserva, reservar, reservando] = useActionState<
    ResultadoReserva,
    FormData
  >(
    async (_prev, formData) => {
      const pid = formData.get("pacienteId") as string;
      const dispId = formData.get("disponibilidadId") as string;
      const h = formData.get("hora") as string;
      if (!pid || !dispId || !h) {
        return { error: "Faltan datos requeridos." };
      }
      return await reservarTurnoTemporal(dispId, pid, h);
    },
    { error: "" },
  );

  // ✅ Manejar reserva exitosa SOLO cuando cambia resultadoReserva (no estado)
  useEffect(() => {
    if (
      esExitoReserva(resultadoReserva) &&
      estado === "SELECCION" &&
      processedReservaRef.current !== resultadoReserva.turnoId
    ) {
      processedReservaRef.current = resultadoReserva.turnoId;
      setTurnoId(resultadoReserva.turnoId);
      setRetenidoHasta(resultadoReserva.retenidoHasta);
      setEstado("RESERVADO");
    }
  }, [resultadoReserva]); // Solo depende de resultadoReserva

  // Resetear processedReservaRef cuando se cancela/expira
  useEffect(() => {
    if (estado === "SELECCION" || estado === "EXPIRADO") {
      processedReservaRef.current = undefined;
    }
  }, [estado]);

  // Manejar reserva - usar startTransition
  const manejarReservar = () => {
    if (!pacienteId || !disponibilidadId || !hora) return;
    const formData = new FormData();
    formData.append("pacienteId", pacienteId);
    formData.append("disponibilidadId", disponibilidadId);
    formData.append("hora", hora);
    startTransition(() => {
      reservar(formData);
    });
  };

  // Manejar expiración de retención
  const manejarExpiracion = () => {
    setEstado("EXPIRADO");
    setTurnoId(undefined);
    setRetenidoHasta(undefined);
  };

  // Manejar confirmación exitosa
  const manejarConfirmado = () => {
    setEstado("CONFIRMADO");
    setMostrarToast(true);
    setRetenidoHasta(undefined);
  };

  // Cerrar toast
  const cerrarToast = () => {
    setMostrarToast(false);
  };

  // Volver a selección - cancela reserva en BD si existe turnoId
  const volverASeleccion = useCallback(async () => {
    if (turnoId) {
      // Cancelar reserva en BD antes de limpiar estado local
      await cancelarReserva(turnoId);
    }
    setEstado("SELECCION");
    setTurnoId(undefined);
    setPacienteId("");
  }, [turnoId]);

  // Loading pacientes
  if (cargandoPacientes) {
    return (
      <div className="sigsam-page">
        <div className="sigsam-page-head">
          <div>
            <div className="sigsam-eyebrow">SIGSAM</div>
            <h1>Confirmar cita</h1>
          </div>
        </div>
        <div className="mx-auto max-w-2xl">
          <div className="sigsam-card p-8 text-center">
            <div className="border-brand mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-3 border-t-transparent" />
            <p className="text-sigsam-text-muted">Cargando tus pacientes…</p>
          </div>
        </div>
      </div>
    );
  }

  // Error de params
  if (errorParams) {
    return (
      <div className="sigsam-page">
        <div className="sigsam-page-head">
          <div>
            <div className="sigsam-eyebrow">SIGSAM</div>
            <h1>Confirmar cita</h1>
          </div>
        </div>
        <div className="mx-auto max-w-2xl">
          <div className="sigsam-card border-red-200 bg-red-50 p-6">
            <div className="flex items-center gap-3">
              <svg
                className="h-6 w-6 flex-shrink-0 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <p className="font-medium text-red-800">
                  No se puede confirmar
                </p>
                <p className="text-sm text-red-700">{errorParams}</p>
              </div>
            </div>
            <button
              onClick={() => window.history.back()}
              className="mt-4 w-full rounded-lg border border-red-300 px-4 py-2 text-red-700 hover:bg-red-50"
            >
              Volver a buscar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Datos del turno para la card
  const datosTurno = {
    medicoNombre: medico!,
    especialidad: especialidad!,
    fecha: fecha!,
    hora: hora!,
    duracionMin: Number(duracionMin!),
    arancel: Number(arancel!),
  };

  return (
    <div className="sigsam-page">
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1>Confirmar cita</h1>
          <p>Revisá y confirmá el turno antes de reservarlo.</p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl">
        {/* Tarjeta del turno - datos reales de searchParams */}
        <TurnoDetalleCard
          medicoNombre={datosTurno.medicoNombre}
          especialidad={datosTurno.especialidad}
          fecha={datosTurno.fecha}
          hora={datosTurno.hora}
          duracionMin={datosTurno.duracionMin}
          arancel={datosTurno.arancel}
          obraSocial={undefined}
          retenidoHasta={retenidoHasta}
          estado={
            estado === "SELECCION"
              ? "DISPONIBLE"
              : estado === "CONFIRMADO"
                ? "CONFIRMADO"
                : "RESERVADO"
          }
        />

        {/* Selector de paciente */}
        {estado === "SELECCION" && (
          <div className="sigsam-card mt-4 p-5">
            <h3 className="text-sigsam-text mb-4 text-lg font-semibold">
              Seleccioná tu perfil
            </h3>
            <form onSubmit={(e) => e.preventDefault()}>
              <select
                value={pacienteId}
                onChange={(e) => setPacienteId(e.target.value)}
                className="border-sigsam-border text-sigsam-text focus:ring-sigsam-primary w-full rounded-lg border bg-white px-4 py-2 focus:ring-2 focus:outline-none disabled:opacity-50"
                required
                disabled={pacientes.length === 0}
              >
                <option value="">-- Elegí un paciente --</option>
                {pacientes.map((p) => (
                  <option key={p.personaId} value={p.personaId}>
                    {p.nombreCompleto} (
                    {p.esTitular ? "Titular" : "Menor tutelado"}) - DNI: {p.dni}
                  </option>
                ))}
              </select>
              {pacientes.length === 0 && (
                <p className="text-sigsam-text-muted mt-2 text-sm">
                  No tenés pacientes vinculados a tu cuenta.
                </p>
              )}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={manejarReservar}
                  disabled={reservando || !pacienteId || pacientes.length === 0}
                  className="sigsam-btn w-full disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reservando ? "Reservando..." : "Reservar por 5 minutos"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Countdown durante retención */}
        {estado === "RESERVADO" && retenidoHasta && (
          <CountdownRetencion
            retenidoHasta={retenidoHasta}
            onExpirar={manejarExpiracion}
            className="mt-4"
          />
        )}

        {/* Mensaje de expiración */}
        {estado === "EXPIRADO" && (
          <div className="sigsam-card mt-4 border-red-200 bg-red-50 p-5">
            <div className="flex items-center gap-3">
              <svg
                className="h-6 w-6 flex-shrink-0 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <p className="font-medium text-red-800">La retención expiró</p>
                <p className="text-sm text-red-700">
                  El cupo ya no está reservado. Podés intentar reservar
                  nuevamente si sigue disponible.
                </p>
              </div>
            </div>
            <button
              onClick={volverASeleccion}
              className="mt-4 w-full rounded-lg border border-red-300 px-4 py-2 text-red-700 hover:bg-red-50"
            >
              Volver a intentar
            </button>
          </div>
        )}

        {/* Modal confirmación definitiva */}
        {estado === "RESERVADO" && turnoId && (
          <ConfirmarReservaDialog
            onClose={volverASeleccion}
            turnoId={turnoId}
            onConfirmado={manejarConfirmado}
          />
        )}

        {/* Estado confirmado */}
        {estado === "CONFIRMADO" && (
          <div className="sigsam-card mt-4 border-green-200 bg-green-50 p-5">
            <div className="flex items-center gap-3">
              <svg
                className="h-6 w-6 flex-shrink-0 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="font-medium text-green-800">¡Turno confirmado!</p>
                <p className="text-sm text-green-700">
                  Tu cita está reservada definitivamente. Recibirás un email de
                  confirmación.
                </p>
              </div>
            </div>
            <div className="mt-4 text-center text-sm text-green-700">
              <p>
                ID de turno:{" "}
                <span className="font-mono font-bold">
                  {turnoId?.slice(-8).toUpperCase()}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Toast de éxito */}
        {mostrarToast && turnoId && (
          <ReservaExitosaToast turnoId={turnoId} onCerrar={cerrarToast} />
        )}

        {/* Nota informativa */}
        <div className="sigsam-card border-sigsam-border bg-sigsam-bg text-sigsam-text-muted mt-4 p-4 text-sm">
          <p className="mb-1 font-medium">Recordá:</p>
          <ul className="list-inside list-disc space-y-1">
            <li>
              La retención dura <strong>5 minutos</strong>. Si no confirmás, el
              cupo se libera.
            </li>
            <li>
              Una vez confirmado, el turno no se puede cancelar desde acá (ver
              US-013).
            </li>
            <li>Llegá 10 minutos antes de tu turno.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function PacienteConfirmarPage({ searchParams }: PageProps) {
  return <ConfirmarContenido searchParams={searchParams} />;
}
