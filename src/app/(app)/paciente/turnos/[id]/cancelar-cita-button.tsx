"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cancelarTurnoPaciente } from "@/app/actions/turnos-paciente";

export function CancelarCitaButton({ turnoId }: { turnoId: string }) {
  const router = useRouter();
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);

  const handleCancelar = async () => {
    if (
      !window.confirm("¿Cancelás esta cita? Esta acción no se puede deshacer.")
    ) {
      return;
    }
    setMensajeError(null);
    setMensajeExito(null);
    setCancelando(true);
    const resultado = await cancelarTurnoPaciente({ turnoId });
    setCancelando(false);
    if ("error" in resultado) {
      setMensajeError(resultado.error);
      return;
    }
    setMensajeExito(resultado.mensaje);
    router.refresh();
  };

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
      {mensajeError && (
        <div
          className="sigsam-notice error"
          role="alert"
          style={{ marginBottom: 12 }}
        >
          <span className="sigsam-notice-symbol" aria-hidden="true">
            !
          </span>
          <p style={{ margin: 0 }}>{mensajeError}</p>
        </div>
      )}
      <button
        type="button"
        className="sigsam-btn"
        onClick={handleCancelar}
        disabled={cancelando}
      >
        {cancelando ? "Cancelando…" : "Cancelar cita"}
      </button>
      <p className="sigsam-muted" style={{ marginTop: 8 }}>
        Podés cancelar hasta 24 horas antes del inicio. Si falta menos tiempo,
        contactá a la sala.
      </p>
    </div>
  );
}
