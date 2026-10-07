"use client";

import { useActionState, useEffect, startTransition } from "react";
import {
  confirmarReservaDefinitiva,
  type ResultadoConfirmacion,
} from "@/app/actions/reservas";
import { X } from "lucide-react";

interface ConfirmarReservaDialogProps {
  onClose: () => void;
  turnoId: string;
  onConfirmado: () => void;
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
}: ConfirmarReservaDialogProps) {
  const [estado, accion, estaPendiente] = useActionState<
    ResultadoConfirmacion,
    FormData
  >(
    async (_prev: ResultadoConfirmacion, _formData: FormData) => {
      return await confirmarReservaDefinitiva(turnoId);
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
