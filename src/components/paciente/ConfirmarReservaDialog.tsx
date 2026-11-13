"use client";

import { useActionState, useEffect, useState, startTransition } from "react";
import {
  confirmarReservaDefinitiva,
  type ResultadoConfirmacion,
} from "@/app/actions/reservas";
import { X } from "lucide-react";
import type { CoberturaPaciente } from "@/lib/pacientes/cobertura";

interface ConfirmarReservaDialogProps {
  onClose: () => void;
  turnoId: string;
  onConfirmado: () => void;
  /** Cobertura del beneficiario elegido (US-028 CA3). */
  cobertura: CoberturaPaciente;
}

// Type guard para discriminated union
function esExito(r: ResultadoConfirmacion): r is { exito: true } {
  return "exito" in r;
}

function esError(r: ResultadoConfirmacion): r is { error: string } {
  return "error" in r;
}

export function ConfirmarReservaDialog({
  onClose,
  turnoId,
  onConfirmado,
  cobertura,
}: ConfirmarReservaDialogProps) {
  const [modalidad, setModalidad] = useState<"PARTICULAR" | "CON_COBERTURA">(
    "PARTICULAR",
  );
  const coberturaUsable = cobertura !== null && cobertura.activa;

  const [estado, accion, estaPendiente] = useActionState<
    ResultadoConfirmacion,
    FormData
  >(
    async (_prev: ResultadoConfirmacion, _formData: FormData) => {
      return await confirmarReservaDefinitiva(turnoId, modalidad);
    },
    { error: "" },
  );

  const manejarConfirmar = () => {
    startTransition(() => {
      accion(new FormData());
    });
  };

  useEffect(() => {
    if (esExito(estado)) {
      onConfirmado();
    }
  }, [estado, onConfirmado]);

  const handleClose = () => {
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="dialog-title"
            className="text-sigsam-text text-lg font-semibold"
          >
            Confirmar turno definitivamente
          </h2>
          <button
            onClick={handleClose}
            disabled={estaPendiente}
            className="text-sigsam-text-muted hover:text-sigsam-text p-1 disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sigsam-text-muted mb-6">
          ¿Confirmás la reserva del turno? Una vez confirmado, el cupo quedará
          asignado definitivamente y no podrá ser tomado por otro paciente.
        </p>

        <fieldset className="mb-6" disabled={estaPendiente}>
          <legend className="text-sigsam-text mb-2 font-medium">
            Modalidad de atención
          </legend>
          <label className="mb-2 flex items-center gap-2">
            <input
              type="radio"
              name="modalidad"
              checked={modalidad === "PARTICULAR"}
              onChange={() => setModalidad("PARTICULAR")}
            />
            Particular
          </label>
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="modalidad"
              className="mt-1"
              checked={modalidad === "CON_COBERTURA"}
              onChange={() => setModalidad("CON_COBERTURA")}
              disabled={!coberturaUsable}
            />
            <span>
              Con cobertura registrada
              {cobertura && (
                <span className="text-sigsam-text-muted block text-sm">
                  {cobertura.nombre} · Plan {cobertura.plan} · Afiliado{" "}
                  {cobertura.numeroAfiliado}
                </span>
              )}
              {!cobertura && (
                <span className="text-sigsam-text-muted block text-sm">
                  No hay cobertura registrada. Podés cargarla en «Mi
                  cobertura».
                </span>
              )}
              {cobertura && !cobertura.activa && (
                <span className="text-sigsam-text-muted block text-sm">
                  La obra social está inactiva y no admite nuevas reservas con
                  cobertura.
                </span>
              )}
            </span>
          </label>
          <p className="text-sigsam-text-muted mt-2 text-xs">
            La cobertura registrada no implica autorización de la obra social.
          </p>
        </fieldset>

        {esError(estado) && estado.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {estado.error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={estaPendiente}
            className="sigsam-btn secondary flex-1 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={manejarConfirmar}
            disabled={estaPendiente}
            className="sigsam-btn flex-1 disabled:opacity-50"
          >
            {estaPendiente ? "Confirmando..." : "Confirmar definitivamente"}
          </button>
        </div>
      </div>
    </div>
  );
}
