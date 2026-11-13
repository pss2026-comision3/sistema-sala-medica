import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { cargarBeneficiarios } from "@/lib/turnos/buscar-horarios";
import {
  obtenerConsultasHistorialPaciente,
  obtenerVacunasAplicadasPaciente,
  obtenerEspecialidadesParaFiltro,
} from "@/lib/turnos/historial-clinico";
import { HistorialView } from "./historial-view";

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function paramUnico(valor: string | string[] | undefined): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

export default async function PacienteHistorialPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // 1. Requiere rol PACIENTE (sesión activa y cuenta habilitada)
  const sesion = await requireRole("PACIENTE");
  const params = await props.searchParams;

  // 2. Cargar beneficiarios autorizados (Titular adulto y menores tutelados vigentes)
  const beneficiarios = await cargarBeneficiarios(BigInt(sesion.usuarioId));
  if (beneficiarios.length === 0) {
    notFound();
  }

  // 3. CA1: Verificación estricta de beneficiario (Anti-IDOR y URLs guardadas)
  const beneficiarioParam = paramUnico(params.beneficiario);
  let beneficiarioSeleccionadoId = beneficiarios[0].id;

  if (beneficiarioParam) {
    const esAutorizado = beneficiarios.some((b) => b.id === beneficiarioParam);
    if (!esAutorizado) {
      // Intento de acceso a un paciente no autorizado o con tutela vencida
      notFound();
    }
    beneficiarioSeleccionadoId = beneficiarioParam;
  }

  // 4. Extraer filtros de URL (CA2)
  const desdeRaw = paramUnico(params.desde);
  const hastaRaw = paramUnico(params.hasta);
  const especialidadRaw = paramUnico(params.especialidad);
  const seccionRaw = paramUnico(params.seccion);

  const desde = desdeRaw && FORMATO_FECHA.test(desdeRaw) ? desdeRaw : undefined;
  const hasta = hastaRaw && FORMATO_FECHA.test(hastaRaw) ? hastaRaw : undefined;
  const especialidadId = especialidadRaw?.trim() || undefined;
  const seccion = seccionRaw === "vacunas" ? "vacunas" : "consultas";

  // 5. Consultas concurrentes de datos clínicos
  const [consultas, vacunas, especialidades] = await Promise.all([
    obtenerConsultasHistorialPaciente({
      beneficiarioId: beneficiarioSeleccionadoId,
      desde,
      hasta,
      especialidadId,
    }),
    obtenerVacunasAplicadasPaciente(beneficiarioSeleccionadoId),
    obtenerEspecialidadesParaFiltro(),
  ]);

  return (
    <div>
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1>Historia clínica</h1>
          <p>
            Información de tus atenciones y de las personas menores que
            representás. Esta vista es de solo lectura.
          </p>
        </div>
      </div>

      <HistorialView
        beneficiarios={beneficiarios}
        beneficiarioSeleccionadoId={beneficiarioSeleccionadoId}
        consultas={consultas}
        vacunas={vacunas}
        especialidades={especialidades}
        filtros={{
          desde,
          hasta,
          especialidadId,
        }}
        seccionInicial={seccion}
      />
    </div>
  );
}
