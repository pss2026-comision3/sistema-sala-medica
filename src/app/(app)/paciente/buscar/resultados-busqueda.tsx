"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { HorarioConsulta } from "@/lib/turnos/buscar-horarios";
import { CalendarioAtencion } from "./calendario-atencion";
import { HorariosSkeleton } from "./horarios-skeleton";

const horarioClase =
  "grid min-h-[126px] w-full content-center justify-items-center gap-1 rounded-md border border-[#a9c9cb] bg-white p-[7px] text-center leading-[1.25] text-ink hover:border-brand hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

type Resultado = {
  fechas: string[];
  horariosPorFecha: Record<string, HorarioConsulta[]>;
  citaMismaEspecialidad: boolean;
  haySuperposiciones: boolean;
};

function fechaLegible(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00.000Z`));
}

function ContenidoHorario({ opcion }: { opcion: HorarioConsulta }) {
  return (
    <>
      <strong className="text-brand text-[15px]">{opcion.hora}</strong>
      <span className="rounded-full bg-[#e6f4ec] px-2 py-0.5 text-[11px] font-bold text-[#176044]">
        Disponible
      </span>
      <small className="text-[11px]">
        Arancel particular: ${Number(opcion.arancel).toLocaleString("es-AR")}
      </small>
      <small className="text-[11px]">
        {opcion.medico} · {opcion.especialidad}
      </small>
      <small className="text-[11px]">
        {fechaLegible(opcion.fecha)} · {opcion.duracionMin} min
      </small>
    </>
  );
}

export function ResultadosBusqueda({
  resultado,
  beneficiarioNombre,
  desde,
  hasta,
  diaInicial,
  horarioInicial,
}: {
  resultado: Resultado;
  beneficiarioNombre: string;
  desde: string;
  hasta: string;
  diaInicial: string;
  horarioInicial: string;
}) {
  const router = useRouter();
  const diasDisponibles = new Set(
    Object.entries(resultado.horariosPorFecha)
      .filter(([, horarios]) => horarios.length > 0)
      .map(([fecha]) => fecha),
  );
  const diaValido = diasDisponibles.has(diaInicial) ? diaInicial : "";
  const [dia, setDia] = useState(diaValido);
  const [horario, setHorario] = useState(horarioInicial);
  const [fechaEnCarga, setFechaEnCarga] = useState("");
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, []);

  function elegirDia(fecha: string) {
    if (fecha === dia && !fechaEnCarga) return;
    if (temporizador.current) clearTimeout(temporizador.current);
    setFechaEnCarga(fecha);
    setHorario("");
    // Los datos están cargados: el estado breve hace perceptible el cambio de día.
    temporizador.current = setTimeout(() => {
      setDia(fecha);
      setFechaEnCarga("");
      temporizador.current = null;
    }, 180);
  }

  const horarios = resultado.horariosPorFecha[dia] ?? [];
  const horarioElegido = horarios.find((h) => h.clave === horario);

  function navegarAConfirmar(opcion: HorarioConsulta) {
    const params = new URLSearchParams({
      disponibilidadId: opcion.disponibilidadId,
      hora: opcion.hora,
      medico: opcion.medico,
      especialidad: opcion.especialidad,
      fecha: opcion.fecha,
      duracionMin: String(opcion.duracionMin),
      arancel: opcion.arancel,
    });
    router.push(`/paciente/confirmar?${params.toString()}`);
  }

  return (
    <>
      <section aria-labelledby="titulo-fechas">
        <div className="sigsam-section-head">
          <h2 id="titulo-fechas">Fechas con atención</h2>
        </div>
        <CalendarioAtencion
          desde={desde}
          hasta={hasta}
          disponibles={diasDisponibles}
          seleccionado={fechaEnCarga || dia}
          onElegirDia={elegirDia}
        />
        {resultado.haySuperposiciones && (
          <p className="text-muted mt-2.5 text-[13px]">
            Algunos horarios se superponen con otra atención del beneficiario y
            no se ofrecen para elegir.
          </p>
        )}
        {!diasDisponibles.size && (
          <div className="sigsam-empty">
            <p>
              No hay horarios disponibles para estos filtros en el rango
              buscado. Cambiá la especialidad, el profesional o la fecha y volvé
              a buscar.
            </p>
          </div>
        )}
      </section>

      {resultado.citaMismaEspecialidad && (
        <div className="sigsam-notice warning" role="status">
          <span className="sigsam-notice-symbol" aria-hidden="true">
            !
          </span>
          <div>
            <strong>Ya hay una cita futura de esta especialidad</strong>
            <p>
              Revisá los turnos de {beneficiarioNombre} antes de elegir otro
              horario.
            </p>
          </div>
        </div>
      )}

      {fechaEnCarga ? (
        <HorariosSkeleton
          cantidad={resultado.horariosPorFecha[fechaEnCarga]?.length ?? 0}
          titulo={`Horarios del ${fechaLegible(fechaEnCarga)}`}
        />
      ) : dia ? (
        <section aria-labelledby="titulo-horarios">
          <div className="sigsam-section-head">
            <h2 id="titulo-horarios">Horarios del {fechaLegible(dia)}</h2>
          </div>
          {horarios.length ? (
            <div className="sigsam-card !p-[18px]">
              <div className="grid grid-cols-2 gap-2 min-[601px]:grid-cols-4">
                {horarios.map((opcion) => (
                  <button
                    type="button"
                    key={opcion.clave}
                    onClick={() => setHorario(opcion.clave)}
                    className={`${horarioClase} ${horarioElegido?.clave === opcion.clave ? "border-brand bg-brand-soft" : ""}`}
                    aria-pressed={horarioElegido?.clave === opcion.clave}
                  >
                    <ContenidoHorario opcion={opcion} />
                  </button>
                ))}
              </div>
              <p className="text-muted !mt-[14px] text-[13px]">
                Los horarios pueden cambiar. Visualizar o elegir uno no
                garantiza el cupo.
              </p>
            </div>
          ) : (
            <div className="sigsam-empty">
              <p>
                No hay horarios libres para este día que cumplan las 24 horas de
                anticipación. Elegí otra fecha o cambiá los filtros.
              </p>
            </div>
          )}
          {horarioElegido && (
            <div className="sigsam-card mt-4 [&_p]:mb-[5px]" role="status">
              <h3>Horario elegido</h3>
              <p>
                <strong>Beneficiario:</strong> {beneficiarioNombre}
              </p>
              <p>
                <strong>Médico:</strong> {horarioElegido.medico}
              </p>
              <p>
                <strong>Especialidad:</strong> {horarioElegido.especialidad}
              </p>
              <p>
                <strong>Fecha e inicio:</strong>{" "}
                {fechaLegible(horarioElegido.fecha)} a las {horarioElegido.hora}
              </p>
              <p>
                <strong>Duración:</strong> {horarioElegido.duracionMin} minutos
              </p>
              <p>
                <strong>Arancel particular:</strong> $
                {Number(horarioElegido.arancel).toLocaleString("es-AR")}
              </p>
              <small className="text-muted mt-3 block">
                La selección no reserva el turno.
              </small>
              <button
                type="button"
                onClick={() => navegarAConfirmar(horarioElegido)}
                className="bg-brand hover:bg-brand-hover mt-4 w-full rounded-lg px-4 py-3 font-medium text-white"
              >
                Reservar este turno
              </button>
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
