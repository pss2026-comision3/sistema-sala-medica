import { requireRole } from "@/lib/auth/guards";
import { cargarBeneficiarios } from "@/lib/turnos/buscar-horarios";
import {
  leerFiltrosTurnos,
  obtenerTurnosPaciente,
} from "@/lib/turnos/consulta-turnos";
import { TurnosView } from "./turnos-view";

export default async function PacienteTurnosPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sesion = await requireRole("PACIENTE");
  const params = await props.searchParams;
  const beneficiarios = await cargarBeneficiarios(BigInt(sesion.usuarioId));
  const filtrosURL = leerFiltrosTurnos(params);
  const beneficiarioSeleccionado =
    params.beneficiario && typeof params.beneficiario === "string"
      ? beneficiarios.find((b) => b.id === params.beneficiario)?.id
      : beneficiarios[0]?.id;

  const { proximos, antecedentes, especialidades, vacunas } =
    await obtenerTurnosPaciente({
      ...filtrosURL,
      beneficiario: beneficiarioSeleccionado || beneficiarios[0]?.id || "",
    });

  return (
    <>
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1>Mis turnos</h1>
          <p>
            Consultá el detalle de tus reservas y de las personas menores
            vinculadas.
          </p>
        </div>
      </div>
      <TurnosView
        beneficiarios={beneficiarios}
        beneficiarioSeleccionado={beneficiarioSeleccionado || ""}
        filtros={{
          ...filtrosURL,
          beneficiario: beneficiarioSeleccionado || "",
        }}
        proximos={proximos}
        antecedentes={antecedentes}
        especialidades={especialidades}
        vacunas={vacunas}
      />
    </>
  );
}
