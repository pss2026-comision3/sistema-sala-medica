"use client";

import { useState } from "react";

const diasSemana = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function mesDe(fecha: string) {
  return fecha.slice(0, 7);
}

function desplazarMes(mes: string, cantidad: number) {
  const [anio, numero] = mes.split("-").map(Number);
  return new Date(Date.UTC(anio, numero - 1 + cantidad, 1))
    .toISOString()
    .slice(0, 7);
}

function fechasDelMes(mes: string) {
  const [anio, numero] = mes.split("-").map(Number);
  const primerDia = new Date(Date.UTC(anio, numero - 1, 1));
  const desplazamiento = (primerDia.getUTCDay() + 6) % 7;
  const inicio = Date.UTC(anio, numero - 1, 1 - desplazamiento);

  return Array.from({ length: 42 }, (_, indice) => {
    const fecha = new Date(inicio + indice * 86_400_000);
    return {
      iso: fecha.toISOString().slice(0, 10),
      numero: fecha.getUTCDate(),
    };
  });
}

export function CalendarioAtencion({
  desde,
  hasta,
  disponibles,
  seleccionado,
  onElegirDia,
}: {
  desde: string;
  hasta: string;
  disponibles: Set<string>;
  seleccionado: string;
  onElegirDia: (fecha: string) => void;
}) {
  const [mes, setMes] = useState(mesDe(seleccionado || desde));
  const primero = mesDe(desde);
  const ultimo = mesDe(hasta);
  const tituloMes = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${mes}-01T00:00:00.000Z`));

  return (
    <div className="sigsam-card !p-[18px] max-[600px]:!p-3">
      <div className="mb-[14px] flex items-center justify-between gap-3">
        <button
          type="button"
          className="border-line text-brand hover:enabled:bg-brand-soft focus-visible:outline-brand h-9 w-9 cursor-pointer rounded-md border bg-white text-[25px] leading-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-50"
          onClick={() => setMes(desplazarMes(mes, -1))}
          disabled={mes <= primero}
          aria-label="Mes anterior"
        >
          ‹
        </button>
        <h3
          className="!m-0 text-center text-base capitalize"
          aria-live="polite"
        >
          {tituloMes}
        </h3>
        <button
          type="button"
          className="border-line text-brand hover:enabled:bg-brand-soft focus-visible:outline-brand h-9 w-9 cursor-pointer rounded-md border bg-white text-[25px] leading-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-50"
          onClick={() => setMes(desplazarMes(mes, 1))}
          disabled={mes >= ultimo}
          aria-label="Mes siguiente"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1.5 max-[600px]:gap-[3px]">
        {diasSemana.map((dia) => (
          <span
            key={dia}
            className="text-muted py-[5px] text-center text-xs font-bold"
          >
            {dia}
          </span>
        ))}
        {fechasDelMes(mes).map(({ iso, numero }) => {
          const enMes = mesDe(iso) === mes;
          const disponible =
            enMes && iso >= desde && iso <= hasta && disponibles.has(iso);
          const activo = disponible && seleccionado === iso;
          return (
            <button
              key={iso}
              type="button"
              className={`focus-visible:outline-brand grid min-h-[52px] content-center justify-items-center gap-0.5 rounded-md border p-1 text-center leading-[1.2] focus-visible:outline-2 focus-visible:outline-offset-2 max-[600px]:min-h-[42px] ${disponible ? "text-ink hover:border-brand hover:bg-brand-soft cursor-pointer border-[#a9c9cb] bg-white font-bold" : "border-line text-muted bg-[#f4f6f6]"} ${activo ? "border-brand bg-brand-soft" : ""} ${enMes ? "" : "opacity-40"}`}
              disabled={!disponible}
              onClick={() => onElegirDia(iso)}
              aria-label={`${numero} de ${new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00.000Z`))}${disponible ? ", con horarios disponibles" : ", sin horarios disponibles"}`}
              aria-pressed={disponible ? activo : undefined}
              title={disponible ? "Ver horarios" : "Sin horarios disponibles"}
            >
              {numero}
              {disponible && (
                <span
                  aria-hidden="true"
                  className="bg-brand h-[5px] w-[5px] rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>
      <p className="text-muted !mt-3 text-xs">
        Los días marcados tienen horarios disponibles. Seleccioná uno para
        verlos.
      </p>
    </div>
  );
}
