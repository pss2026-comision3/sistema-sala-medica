"use client";

import { useState } from "react";
import type {
  CitaEspecialidadVigente,
  FiltrosHorarios,
} from "@/lib/turnos/buscar-horarios";

type Beneficiario = { id: string; nombre: string; tipo: string };
type Especialidad = {
  id: string;
  nombre: string;
  medicos: { id: string; nombre: string }[];
};

function fechaLegible(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00.000Z`));
}

export function BuscarForm({
  beneficiarios,
  catalogo,
  citasVigentes,
  filtros,
  hoy,
  fechaMaxima,
  buscando,
  onBuscar,
  onCambiarFiltros,
}: {
  beneficiarios: Beneficiario[];
  catalogo: Especialidad[];
  citasVigentes: CitaEspecialidadVigente[];
  filtros: FiltrosHorarios;
  hoy: string;
  fechaMaxima: string;
  buscando: boolean;
  onBuscar: (datos: FormData) => void;
  onCambiarFiltros: () => void;
}) {
  const [beneficiario, setBeneficiario] = useState(
    beneficiarios.some((item) => item.id === filtros.beneficiario)
      ? (filtros.beneficiario ?? "")
      : "",
  );
  const [especialidad, setEspecialidad] = useState(
    beneficiario && catalogo.some((item) => item.id === filtros.especialidad)
      ? (filtros.especialidad ?? "")
      : "",
  );
  const citaExistente = citasVigentes.find(
    (cita) =>
      cita.beneficiarioId === beneficiario &&
      cita.especialidadId === especialidad,
  );
  const medicos =
    catalogo.find((item) => item.id === especialidad)?.medicos ?? [];
  const [medico, setMedico] = useState(
    !citaExistente && medicos.some((item) => item.id === filtros.medico)
      ? (filtros.medico ?? "")
      : "",
  );
  const [fecha, setFecha] = useState(medico ? (filtros.fecha ?? "") : "");
  const [errorFecha, setErrorFecha] = useState("");
  const mensajeFecha =
    "La fecha está fuera del rango permitido: de hoy a 60 días.";

  return (
    <form
      method="get"
      className="grid grid-cols-1 gap-x-3 gap-y-[18px] min-[601px]:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!citaExistente) onBuscar(new FormData(event.currentTarget));
      }}
    >
      <input type="hidden" name="buscar" value="1" />
      <div className="sigsam-field">
        <label htmlFor="beneficiario">Beneficiario *</label>
        <select
          id="beneficiario"
          name="beneficiario"
          value={beneficiario}
          onChange={(event) => {
            onCambiarFiltros();
            setBeneficiario(event.target.value);
            setEspecialidad("");
            setMedico("");
            setFecha("");
            setErrorFecha("");
          }}
          required
        >
          <option value="">Elegí el paciente atendido</option>
          {beneficiarios.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nombre} · {b.tipo}
            </option>
          ))}
        </select>
      </div>
      <div className="sigsam-field">
        <label
          htmlFor="especialidad"
          className={!beneficiario ? "!text-muted" : undefined}
        >
          Especialidad *
        </label>
        <select
          id="especialidad"
          name="especialidad"
          value={especialidad}
          onChange={(event) => {
            onCambiarFiltros();
            setEspecialidad(event.target.value);
            setMedico("");
            setFecha("");
            setErrorFecha("");
          }}
          disabled={!beneficiario}
          aria-describedby={
            citaExistente ? "aviso-cita-especialidad" : undefined
          }
          className="disabled:!border-line disabled:!text-muted disabled:!cursor-not-allowed disabled:!bg-[#f1f3f4] disabled:!opacity-100"
          required
        >
          <option value="">
            {beneficiario
              ? "Elegí una especialidad"
              : "Elegí primero un beneficiario"}
          </option>
          {catalogo.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nombre}
            </option>
          ))}
        </select>
      </div>
      {citaExistente && (
        <div
          id="aviso-cita-especialidad"
          className="sigsam-notice warning col-span-full"
          role="alert"
        >
          <span className="sigsam-notice-symbol" aria-hidden="true">
            !
          </span>
          <div>
            <strong>Ya tiene un turno de esta especialidad</strong>
            <p>
              {beneficiarios.find((item) => item.id === beneficiario)?.nombre}{" "}
              ya tiene un turno de{" "}
              {catalogo.find((item) => item.id === especialidad)?.nombre} el{" "}
              {fechaLegible(citaExistente.fecha)}. Podés volver a elegir esta
              especialidad cuando pase ese día o si cancelás el turno.
            </p>
          </div>
        </div>
      )}
      <div className="sigsam-field">
        <label
          htmlFor="medico"
          className={!especialidad || citaExistente ? "!text-muted" : undefined}
        >
          Profesional *
        </label>
        <select
          id="medico"
          name="medico"
          value={medico}
          onChange={(event) => {
            onCambiarFiltros();
            setMedico(event.target.value);
            setFecha("");
            setErrorFecha("");
          }}
          disabled={!especialidad || !!citaExistente}
          className="disabled:!border-line disabled:!text-muted disabled:!cursor-not-allowed disabled:!bg-[#f1f3f4] disabled:!opacity-100"
          required
        >
          <option value="">
            {citaExistente
              ? "Ya tiene un turno de esta especialidad"
              : especialidad
                ? "Elegí un profesional"
                : "Elegí primero una especialidad"}
          </option>
          {medicos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="sigsam-field">
        <label htmlFor="fecha" className={!medico ? "!text-muted" : undefined}>
          Fecha desde *
        </label>
        <input
          id="fecha"
          name="fecha"
          type="date"
          min={hoy}
          max={fechaMaxima}
          value={fecha}
          disabled={!medico}
          className="disabled:!border-line disabled:!text-muted disabled:!cursor-not-allowed disabled:!bg-[#f1f3f4] disabled:!opacity-100"
          aria-invalid={!!errorFecha}
          aria-describedby={errorFecha ? "error-fecha" : undefined}
          onChange={(event) => {
            onCambiarFiltros();
            const valor = event.currentTarget.value;
            setFecha(valor);
            setErrorFecha(
              valor && (valor < hoy || valor > fechaMaxima) ? mensajeFecha : "",
            );
          }}
          onInvalid={(event) => {
            if (
              event.currentTarget.validity.rangeUnderflow ||
              event.currentTarget.validity.rangeOverflow
            ) {
              setErrorFecha(mensajeFecha);
            }
          }}
          required
        />
      </div>
      {errorFecha && (
        <div
          id="error-fecha"
          className="sigsam-alert-error col-span-full !m-0"
          role="alert"
        >
          {errorFecha}
        </div>
      )}
      <div className="col-span-full mt-0.5">
        <button
          type="submit"
          className="sigsam-btn small w-[190px] disabled:!cursor-not-allowed disabled:!border-[#aebbbd] disabled:!bg-[#aebbbd]"
          aria-busy={buscando}
          disabled={
            !beneficiario ||
            !especialidad ||
            !!citaExistente ||
            !medico ||
            !fecha ||
            buscando
          }
        >
          {buscando ? "Cargando horarios…" : "Buscar horarios"}
        </button>
      </div>
    </form>
  );
}
