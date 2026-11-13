import {
  buscarHorariosEnFechas,
  cargarCitasVigentesEspecialidad,
  fechaIsoValida,
  hoySala,
  sumarDias,
  type FiltrosHorarios,
} from "@/lib/turnos/buscar-horarios";

export type Beneficiarios = Awaited<
  ReturnType<typeof import("@/lib/turnos/buscar-horarios").cargarBeneficiarios>
>;
export type Catalogo = Awaited<
  ReturnType<typeof import("@/lib/turnos/buscar-horarios").cargarCatalogoMedico>
>;

export type DatosBusqueda = {
  error: string;
  resultado: Awaited<ReturnType<typeof buscarHorariosEnFechas>> | null;
  beneficiarioNombre: string;
  desde: string;
  hasta: string;
};

function fechaLegible(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00.000Z`));
}

export async function consultarBusqueda(
  filtros: FiltrosHorarios,
  beneficiarios: Beneficiarios,
  catalogo: Catalogo,
  ahora = new Date(),
): Promise<DatosBusqueda> {
  const hoy = hoySala(ahora);
  const hasta = sumarDias(hoy, 60);
  const beneficiario = beneficiarios.find((b) => b.id === filtros.beneficiario);
  const especialidad = catalogo.find((e) => e.id === filtros.especialidad);
  const medico = especialidad?.medicos.find((m) => m.id === filtros.medico);
  const citaExistente =
    beneficiario && especialidad
      ? (
          await cargarCitasVigentesEspecialidad(
            [BigInt(beneficiario.id)],
            ahora,
            BigInt(especialidad.id),
          )
        )[0]
      : undefined;
  let error = "";

  if (!beneficiario) error = "Seleccioná un beneficiario válido para buscar.";
  else if (!especialidad) error = "Seleccioná una especialidad válida.";
  else if (citaExistente)
    error = `${beneficiario.nombre} ya tiene un turno de ${especialidad.nombre} el ${fechaLegible(citaExistente.fecha)}. Podés volver a elegir esta especialidad cuando pase ese día o si cancelás el turno.`;
  else if (!medico)
    error = filtros.medico
      ? "El profesional no pertenece a la especialidad elegida."
      : "Seleccioná un profesional para buscar.";
  else if (
    !fechaIsoValida(filtros.fecha ?? "") ||
    (filtros.fecha ?? "") < hoy ||
    (filtros.fecha ?? "") > hasta
  )
    error = `La fecha está fuera del rango permitido: de hoy al ${fechaLegible(hasta)}.`;

  const fechaMinima = hoySala(new Date(ahora.getTime() + 86_400_000));
  const desde =
    (filtros.fecha ?? hoy) > fechaMinima ? filtros.fecha! : fechaMinima;

  return {
    error,
    resultado:
      !error && beneficiario && especialidad && medico
        ? await buscarHorariosEnFechas(
            BigInt(beneficiario.id),
            BigInt(especialidad.id),
            BigInt(medico.id),
            desde,
            hasta,
            ahora,
          )
        : null,
    beneficiarioNombre: beneficiario?.nombre ?? "",
    desde,
    hasta,
  };
}
