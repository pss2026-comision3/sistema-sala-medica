"use client";

import { useState } from "react";
import { useActionState } from "react";
import {
  reservarTurnoTemporal,
  type ResultadoReserva,
} from "@/app/actions/reservas";
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

// Mock data mientras US-011 no está listo
const MOCK_DISPONIBILIDAD = {
  disponibilidadId: "mock-disp-1",
  medicoNombre: "Dra. Valeria Ruiz",
  especialidad: "Clínica Médica",
  fecha: "2026-10-15",
  hora: "09:30",
  duracionMin: 20,
  arancel: 5000,
  obraSocial: "OSDE 210",
};

type EstadoPagina = "SELECCION" | "RESERVADO" | "CONFIRMADO" | "EXPIRADO";

export default function PacienteConfirmarPage() {
  const [estado, setEstado] = useState<EstadoPagina>("SELECCION");
  const [turnoId, setTurnoId] = useState<string>();
  const [retenidoHasta, setRetenidoHasta] = useState<Date>();
  const [mostrarToast, setMostrarToast] = useState(false);
  const [pacienteId, setPacienteId] = useState<string>("");

  // Server Action: reservar turno temporal
  const [resultadoReserva, reservar, reservando] = useActionState<
    ResultadoReserva,
    FormData
  >(
    async (_prev, formData) => {
      const pid = formData.get("pacienteId") as string;
      const dispId = formData.get("disponibilidadId") as string;
      const hora = formData.get("hora") as string;
      if (!pid || !dispId || !hora) {
        return { error: "Faltan datos requeridos." };
      }
      return await reservarTurnoTemporal(dispId, pid, hora);
    },
    { error: "" }, // estado inicial como error vacío
  );

  // Manejar reserva exitosa (en el handler, no en useEffect)
  const manejarReservar = () => {
    if (!pacienteId) return;
    const formData = new FormData();
    formData.append("pacienteId", pacienteId);
    formData.append("disponibilidadId", MOCK_DISPONIBILIDAD.disponibilidadId);
    formData.append("hora", MOCK_DISPONIBILIDAD.hora);
    reservar(formData);
  };

  // Revisar resultado después de que se actualice el estado
  if (esExitoReserva(resultadoReserva) && estado === "SELECCION") {
    setTurnoId(resultadoReserva.turnoId);
    setRetenidoHasta(resultadoReserva.retenidoHasta);
    setEstado("RESERVADO");
  }

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

  // Volver a selección (si expiró o quiere cambiar)
  const volverASeleccion = () => {
    setEstado("SELECCION");
    setTurnoId(undefined);
    setPacienteId("");
  };

  // Datos a mostrar
  const datos = MOCK_DISPONIBILIDAD;

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
        {/* Tarjeta del turno */}
        <TurnoDetalleCard
          medicoNombre={datos.medicoNombre}
          especialidad={datos.especialidad}
          fecha={datos.fecha}
          hora={datos.hora}
          duracionMin={datos.duracionMin}
          arancel={datos.arancel}
          obraSocial={datos.obraSocial}
          retenidoHasta={retenidoHasta}
          estado={
            estado === "SELECCION"
              ? "DISPONIBLE"
              : estado === "CONFIRMADO"
                ? "CONFIRMADO"
                : "RESERVADO"
          }
        />

        {/* Selector de paciente (requerido para reservar) */}
        {estado === "SELECCION" && (
          <div className="sigsam-card mt-4 p-5">
            <h3 className="text-sigsam-text mb-4 text-lg font-semibold">
              Seleccioná tu perfil
            </h3>
            <form onSubmit={(e) => e.preventDefault()}>
              <select
                value={pacienteId}
                onChange={(e) => setPacienteId(e.target.value)}
                className="border-sigsam-border text-sigsam-text focus:ring-sigsam-primary w-full rounded-lg border bg-white px-4 py-2 focus:ring-2 focus:outline-none"
                required
              >
                <option value="">-- Elegí un paciente --</option>
                {/* TODO: Cargar pacientes reales del usuario logueado */}
                <option value="mock-paciente-1">Juan Pérez (Titular)</option>
                <option value="mock-paciente-2">
                  Ana Pérez (Menor - Tutelada)
                </option>
              </select>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={manejarReservar}
                  disabled={reservando || !pacienteId}
                  className="bg-sigsam-primary hover:bg-sigsam-primary-hover w-full rounded-lg px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
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
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
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
            open={true}
            onClose={() => setEstado("SELECCION")}
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
        <div className="bg-sigsam-bg border-sigsam-border text-sigsam-text-muted mt-6 rounded-lg border p-4 text-sm">
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
