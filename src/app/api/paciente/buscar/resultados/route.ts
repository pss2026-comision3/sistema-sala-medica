import { getSession } from "@/lib/auth/session";
import {
  cargarBeneficiarios,
  cargarCatalogoMedico,
  type FiltrosHorarios,
} from "@/lib/turnos/buscar-horarios";
import { consultarBusqueda } from "@/app/(app)/paciente/buscar/consultar-busqueda";

export async function GET(request: Request) {
  const sesion = await getSession();
  if (!sesion || sesion.rol !== "PACIENTE" || sesion.claveTemporal) {
    return Response.json({ error: "Sesión no válida." }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const filtros: FiltrosHorarios = {
    beneficiario: params.get("beneficiario") ?? "",
    especialidad: params.get("especialidad") ?? "",
    medico: params.get("medico") ?? "",
    fecha: params.get("fecha") ?? "",
  };
  const ahora = new Date();
  const [beneficiarios, catalogo] = await Promise.all([
    cargarBeneficiarios(BigInt(sesion.usuarioId), ahora),
    cargarCatalogoMedico(),
  ]);
  const datos = await consultarBusqueda(
    filtros,
    beneficiarios,
    catalogo,
    ahora,
  );

  return Response.json(datos, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
