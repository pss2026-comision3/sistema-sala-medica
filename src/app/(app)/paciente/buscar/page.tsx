import { requireRole } from "@/lib/auth/guards";
import {
  cargarBeneficiarios,
  cargarCatalogoMedico,
  hoySala,
  sumarDias,
  type FiltrosHorarios,
} from "@/lib/turnos/buscar-horarios";
import { BusquedaInteractiva } from "./busqueda-interactiva";
import { consultarBusqueda } from "./consultar-busqueda";

type Parametros = Record<string, string | string[] | undefined>;
const leer = (params: Parametros, clave: string) =>
  typeof params[clave] === "string" ? (params[clave] as string) : "";

export default async function PacienteBuscarPage({
  searchParams,
}: {
  searchParams: Promise<Parametros>;
}) {
  const sesion = await requireRole("PACIENTE");
  const params = await searchParams;
  const ahora = new Date();
  const hoy = hoySala(ahora);
  const fechaMaxima = sumarDias(hoy, 60);
  const [beneficiarios, catalogo] = await Promise.all([
    cargarBeneficiarios(BigInt(sesion.usuarioId), ahora),
    cargarCatalogoMedico(),
  ]);
  const filtros: FiltrosHorarios = {
    beneficiario: leer(params, "beneficiario"),
    especialidad: leer(params, "especialidad"),
    medico: leer(params, "medico"),
    fecha: leer(params, "fecha") || hoy,
  };
  const busco = leer(params, "buscar") === "1";
  const datosIniciales = busco
    ? await consultarBusqueda(filtros, beneficiarios, catalogo, ahora)
    : null;

  return (
    <div className="max-w-[900px] [&_h2]:text-xl">
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1>Buscar un turno médico</h1>
          <p>
            Filtrá por especialidad, profesional y fecha. La reserva se confirma
            en el siguiente paso.
          </p>
        </div>
      </div>
      <div
        className="-mt-2 mb-5 flex gap-2 text-[13px] font-bold"
        aria-label="Pasos de la reserva"
      >
        <span className="bg-brand-soft text-brand rounded-full border border-[#a9c9cb] px-[11px] py-[3px]">
          1 · Elegir horario
        </span>
        <span className="border-line rounded-full border bg-white px-[11px] py-[3px]">
          2 · Confirmar
        </span>
      </div>
      <BusquedaInteractiva
        beneficiarios={beneficiarios}
        catalogo={catalogo}
        filtros={filtros}
        hoy={hoy}
        fechaMaxima={fechaMaxima}
        datosIniciales={datosIniciales}
        diaInicial={leer(params, "dia")}
        horarioInicial={leer(params, "horario")}
      />
    </div>
  );
}
