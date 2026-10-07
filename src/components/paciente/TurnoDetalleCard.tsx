"use client";

import { formatearTiempoRestante } from "@/lib/agenda/reservas";

interface TurnoDetalleCardProps {
  medicoNombre: string;
  especialidad: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM
  duracionMin: number;
  arancel: number;
  obraSocial?: string | null;
  retenidoHasta?: Date | null; // si ya reservó, muestra countdown
  estado: "DISPONIBLE" | "RESERVADO" | "CONFIRMADO";
}

export function TurnoDetalleCard({
  medicoNombre,
  especialidad,
  fecha,
  hora,
  duracionMin,
  arancel,
  obraSocial,
  retenidoHasta,
  estado,
}: TurnoDetalleCardProps) {
  const fechaFormateada = new Date(`${fecha}T12:00:00Z`).toLocaleDateString(
    "es-AR",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
    },
  );

  const mostrarCountdown = estado === "RESERVADO" && retenidoHasta;
  const tiempoRestante = mostrarCountdown
    ? formatearTiempoRestante(retenidoHasta)
    : null;

  return (
    <div className="sigsam-card p-5">
      <div className="flex flex-col gap-4">
        {/* Header con estado */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sigsam-text text-lg font-semibold">
              {medicoNombre}
            </h3>
            <p className="text-sigsam-text-muted text-sm">{especialidad}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              estado === "DISPONIBLE"
                ? "bg-green-100 text-green-800"
                : estado === "RESERVADO"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-blue-100 text-blue-800"
            }`}
          >
            {estado === "DISPONIBLE" && "Disponible"}
            {estado === "RESERVADO" && `Retención ${tiempoRestante}`}
            {estado === "CONFIRMADO" && "Confirmado"}
          </span>
        </div>

        <div className="border-sigsam-border flex flex-col gap-3 border-t pt-4">
          {/* Fecha y hora */}
          <div className="text-sigsam-text flex items-center gap-3">
            <svg
              className="text-sigsam-text-muted h-5 w-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <div>
              <p className="font-medium">{fechaFormateada}</p>
              <p className="text-sigsam-text-muted text-sm">
                {hora} hs · {duracionMin} min
              </p>
            </div>
          </div>

          {/* Arancel */}
          <div className="text-sigsam-text flex items-center gap-3">
            <svg
              className="text-sigsam-text-muted h-5 w-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="font-medium">
                ${arancel.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sigsam-text-muted text-sm">
                Arancel particular
              </p>
            </div>
          </div>

          {/* Obra social si tiene */}
          {obraSocial && (
            <div className="text-sigsam-text flex items-center gap-3">
              <svg
                className="text-sigsam-text-muted h-5 w-5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
              <p className="text-sm">{obraSocial}</p>
            </div>
          )}
        </div>

        {/* Countdown visual si está reservado */}
        {mostrarCountdown && (
          <div className="border-t border-yellow-200 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-yellow-800">
                Tiempo para confirmar:
              </span>
              <span className="font-mono text-lg font-bold text-yellow-700">
                {tiempoRestante}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-yellow-100">
              <div
                className="h-full bg-yellow-500 transition-all duration-1000 ease-linear"
                style={{
                  width: `${(tiempoRestanteMs(retenidoHasta!) / (5 * 60 * 1000)) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper local para no importar de reservas.ts en client component
function tiempoRestanteMs(
  retenidoHasta: Date,
  ahora: Date = new Date(),
): number {
  const diff = retenidoHasta.getTime() - ahora.getTime();
  return diff > 0 ? diff : 0;
}
