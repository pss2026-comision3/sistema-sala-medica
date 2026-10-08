"use client";

import { useEffect } from "react";
import { CheckCircle } from "lucide-react";

interface ReservaExitosaToastProps {
  turnoId: string;
  onCerrar: () => void;
  autoCerrarMs?: number;
}

export function ReservaExitosaToast({
  turnoId,
  onCerrar,
  autoCerrarMs = 5000,
}: ReservaExitosaToastProps) {
  useEffect(() => {
    const timer = setTimeout(onCerrar, autoCerrarMs);
    return () => clearTimeout(timer);
  }, [onCerrar, autoCerrarMs]);

  return (
    <div
      className="animate-slide-in fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 shadow-lg"
      role="alert"
      aria-live="polite"
    >
      <div className="flex-shrink-0">
        <CheckCircle className="h-6 w-6 text-green-600" />
      </div>
      <div className="text-sm text-green-800">
        <p className="font-medium">¡Turno confirmado!</p>
        <p className="text-xs text-green-700">
          ID: {turnoId.slice(-8).toUpperCase()}
        </p>
      </div>
      <button
        onClick={onCerrar}
        className="ml-2 p-1 text-green-600 hover:text-green-800"
        aria-label="Cerrar"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
