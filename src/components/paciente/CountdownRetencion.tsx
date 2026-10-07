"use client";

import { useEffect, useState } from "react";
import {
  formatearTiempoRestante,
  tiempoRestanteMs,
} from "@/lib/agenda/reservas";

interface CountdownRetencionProps {
  retenidoHasta: Date;
  onExpirar: () => void;
  className?: string;
}

export function CountdownRetencion({
  retenidoHasta,
  onExpirar,
  className = "",
}: CountdownRetencionProps) {
  const [tiempoRestante, setTiempoRestante] = useState<string>(
    formatearTiempoRestante(retenidoHasta),
  );
  const [expirado, setExpirado] = useState(false);

  useEffect(() => {
    const actualizar = () => {
      const ahora = new Date();
      const ms = tiempoRestanteMs(retenidoHasta, ahora);
      if (ms === 0) {
        setTiempoRestante("0s");
        setExpirado(true);
        onExpirar();
      } else {
        setTiempoRestante(formatearTiempoRestante(retenidoHasta, ahora));
      }
    };

    actualizar();
    const intervalo = setInterval(actualizar, 1000);
    return () => clearInterval(intervalo);
  }, [retenidoHasta, onExpirar]);

  if (expirado) return null; // el padre maneja qué mostrar al expirar

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2 ${className}`}
      role="timer"
      aria-live="polite"
    >
      <svg
        className="h-5 w-5 flex-shrink-0 text-yellow-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="text-sm text-yellow-800">Tiempo para confirmar:</span>
      <span className="font-mono text-lg font-bold text-yellow-700 tabular-nums">
        {tiempoRestante}
      </span>
      <div className="ml-2 h-1.5 max-w-xs flex-1 overflow-hidden rounded-full bg-yellow-100">
        <div
          className="h-full bg-yellow-500 transition-all duration-1000 ease-linear"
          style={{
            width: `${(tiempoRestanteMs(retenidoHasta) / (5 * 60 * 1000)) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}
