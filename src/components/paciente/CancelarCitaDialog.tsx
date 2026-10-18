"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

import { cancelarTurnoPaciente } from "@/app/actions/turnos-paciente";
import { etiquetaFecha } from "@/lib/agenda/reglas";

type Resultado = { exito: true; mensaje: string } | { error: string };

/// CA2 (US-014): datos que el paciente debe ver antes de aceptar la cancelación.
export type CitaCancelable = {
  id: string;
  beneficiarioNombre: string;
  prestacion: string;
  fecha: string;
  hora: string;
  profesional: string;
  pendienteDeResolver: boolean;
  motivoSuspension: string | null;
};

export function CancelarCitaDialog({
  cita,
  onClose,
  onCancelado,
}: {
  cita: CitaCancelable;
  onClose: () => void;
  onCancelado: (mensaje: string) => void;
}) {
  const [estado, accion, pendiente] = useActionState<Resultado, FormData>(
    async (_prev, formData) =>
      await cancelarTurnoPaciente({
        turnoId: cita.id,
        motivo: String(formData.get("motivo") ?? ""),
      }),
    { error: "" },
  );

  useEffect(() => {
    if ("exito" in estado && estado.exito) {
      onCancelado(estado.mensaje);
    }
  }, [estado, onCancelado]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancelar-cita-titulo"
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="cancelar-cita-titulo"
            className="text-sigsam-text text-lg font-semibold"
          >
            Cancelar la cita
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pendiente}
            className="text-sigsam-text-muted hover:text-sigsam-text p-1 disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sigsam-text-muted mb-4">
          Vas a cancelar la siguiente cita. Esta acción no se puede deshacer.
        </p>

        <dl className="mb-4 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-sigsam-text-muted">Beneficiario</dt>
            <dd className="text-sigsam-text font-medium">
              {cita.beneficiarioNombre}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-sigsam-text-muted">Prestación</dt>
            <dd className="text-sigsam-text font-medium">{cita.prestacion}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-sigsam-text-muted">Fecha y hora</dt>
            <dd className="text-sigsam-text font-medium">
              {etiquetaFecha(cita.fecha)} — {cita.hora} hs
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-sigsam-text-muted">Profesional</dt>
            <dd className="text-sigsam-text font-medium">{cita.profesional}</dd>
          </div>
        </dl>

        {cita.pendienteDeResolver && (
          <div className="sigsam-notice info mb-4">
            <span className="sigsam-notice-symbol" aria-hidden="true">
              i
            </span>
            <p style={{ margin: 0 }}>
              La jornada está suspendida
              {cita.motivoSuspension ? ` (${cita.motivoSuspension})` : ""}. Al
              cancelar, este horario no volverá a estar disponible.
            </p>
          </div>
        )}

        <form action={accion}>
          <label
            htmlFor="cancelar-motivo"
            className="text-sigsam-text mb-1 block text-sm font-medium"
          >
            Motivo (opcional)
          </label>
          <textarea
            id="cancelar-motivo"
            name="motivo"
            rows={3}
            maxLength={500}
            placeholder="Podés indicar por qué no podés asistir."
            disabled={pendiente}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm disabled:opacity-50"
          />

          {"error" in estado && estado.error && (
            <div
              className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              role="alert"
            >
              {estado.error}
            </div>
          )}

          <p className="text-sigsam-text-muted mt-3 text-sm">
            Podés cancelar hasta 24 horas antes del inicio. Si falta menos
            tiempo, contactá a la sala para gestionarla presencialmente.
          </p>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={pendiente}
              className="sigsam-btn secondary flex-1 disabled:opacity-50"
            >
              Volver
            </button>
            <button
              type="submit"
              disabled={pendiente}
              className="sigsam-btn flex-1 disabled:opacity-50"
            >
              {pendiente ? "Cancelando..." : "Cancelar cita"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/// Acciones de cancelación de una cita. Se usa tanto en la ficha de la cita
/// como en la lista "Mis turnos" para no duplicar la lógica de confirmación
/// (CA2). Se renderiza siempre (aun cuando `cancelable` sea falso) para que el
/// mensaje de éxito sobreviva al refresh del servidor tras cancelar.
export function AccionesCancelacion({
  cita,
  cancelable,
  cancelableMotivo,
  etiqueta = "Cancelar cita",
  mostrarNota = true,
  mostrarMotivoNoCancelable = true,
}: {
  cita: CitaCancelable;
  cancelable: boolean;
  cancelableMotivo: string;
  etiqueta?: string;
  mostrarNota?: boolean;
  mostrarMotivoNoCancelable?: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  if (!cancelable) {
    return (
      <div>
        {mensajeExito && (
          <div
            className="sigsam-notice success"
            role="status"
            style={{ marginBottom: 12 }}
          >
            <span className="sigsam-notice-symbol" aria-hidden="true">
              ✓
            </span>
            <p style={{ margin: 0 }}>{mensajeExito}</p>
          </div>
        )}
        {mostrarMotivoNoCancelable && (
          <div className="sigsam-notice info">
            <span className="sigsam-notice-symbol" aria-hidden="true">
              i
            </span>
            <p style={{ margin: 0 }}>{cancelableMotivo}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {mensajeExito && (
        <div
          className="sigsam-notice success"
          role="status"
          style={{ marginBottom: 12 }}
        >
          <span className="sigsam-notice-symbol" aria-hidden="true">
            ✓
          </span>
          <p style={{ margin: 0 }}>{mensajeExito}</p>
        </div>
      )}
      <button
        type="button"
        className="sigsam-btn"
        onClick={() => setAbierto(true)}
      >
        {etiqueta}
      </button>
      {mostrarNota && (
        <p className="sigsam-muted" style={{ marginTop: 8 }}>
          Podés cancelar hasta 24 horas antes del inicio. Si falta menos tiempo,
          contactá a la sala.
        </p>
      )}
      {abierto && (
        <CancelarCitaDialog
          cita={cita}
          onClose={() => setAbierto(false)}
          onCancelado={(mensaje) => {
            setAbierto(false);
            setMensajeExito(mensaje);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
