"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { registrarAusencia } from "@/app/actions/resultados";

type Props = {
  turnoId: string;
  /** CA1 a CA4 (US-016): si la cita admite hoy el registro de la ausencia. */
  puede: boolean;
  /** Motivo por el que la ausencia no está disponible (se muestra al usuario). */
  motivo: string;
  /** Texto del botón; el vacunatorio usa "Registrar ausencia". */
  etiqueta?: string;
};

/**
 * US-SIG-016: registra el resultado `Ausente` de una cita ya finalizada. El
 * botón solo se habilita cuando las reglas lo permiten; el servidor vuelve a
 * validar todo al ejecutar la operación.
 */
export function RegistrarAusenciaButton({
  turnoId,
  puede,
  motivo,
  etiqueta = "Registrar ausencia",
}: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [mensaje, setMensaje] = useState<{
    tipo: "exito" | "error";
    texto: string;
  } | null>(null);
  const [pendiente, startTransition] = useTransition();

  const confirmar = () => {
    startTransition(async () => {
      const resultado = await registrarAusencia(turnoId);
      if ("error" in resultado) {
        setMensaje({ tipo: "error", texto: resultado.error });
        return;
      }
      setAbierto(false);
      setMensaje({ tipo: "exito", texto: resultado.mensaje });
      router.refresh();
    });
  };

  return (
    <div>
      {mensaje?.tipo === "exito" && (
        <div
          className="sigsam-notice success"
          role="status"
          style={{ marginBottom: 12 }}
        >
          <span className="sigsam-notice-symbol" aria-hidden="true">
            ✓
          </span>
          <p style={{ margin: 0 }}>{mensaje.texto}</p>
        </div>
      )}
      {mensaje?.tipo === "error" && (
        <div
          className="sigsam-notice error"
          role="alert"
          style={{ marginBottom: 12 }}
        >
          <span className="sigsam-notice-symbol" aria-hidden="true">
            !
          </span>
          <p style={{ margin: 0 }}>{mensaje.texto}</p>
        </div>
      )}

      {puede ? (
        <button
          type="button"
          className="sigsam-btn secondary"
          onClick={() => {
            setMensaje(null);
            setAbierto(true);
          }}
          disabled={pendiente}
        >
          {etiqueta}
        </button>
      ) : (
        <div className="sigsam-notice info">
          <span className="sigsam-notice-symbol" aria-hidden="true">
            i
          </span>
          <p style={{ margin: 0 }}>{motivo}</p>
        </div>
      )}

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="registrar-ausencia-titulo"
          onClick={() => !pendiente && setAbierto(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(evento) => evento.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2
                id="registrar-ausencia-titulo"
                className="text-lg font-semibold"
              >
                Registrar ausencia
              </h2>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="text-sigsam-text-muted hover:text-sigsam-text p-1"
                aria-label="Cerrar"
                disabled={pendiente}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ marginTop: 0 }}>
              El resultado de esta cita será <strong>Ausente</strong>. La reserva
              se conserva y queda identificada por separado del resultado de
              atención.
            </p>
            <div className="flex gap-3" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="sigsam-btn secondary flex-1"
                onClick={() => setAbierto(false)}
                disabled={pendiente}
              >
                Volver
              </button>
              <button
                type="button"
                className="sigsam-btn flex-1"
                onClick={confirmar}
                disabled={pendiente}
              >
                {pendiente ? "Registrando..." : "Registrar ausencia"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
