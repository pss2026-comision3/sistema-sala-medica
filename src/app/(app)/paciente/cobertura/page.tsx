import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/guards";
import { coberturaDe, SELECCION_COBERTURA } from "@/lib/pacientes/cobertura";
import { cargarBeneficiarios } from "@/lib/turnos/buscar-horarios";
import { CoberturaForm } from "@/components/paciente/CoberturaForm";

/** US-028 CA1/CA2: cobertura del titular y de los menores a cargo. */
export default async function PacienteCoberturaPage() {
  const sesion = await requireRole("PACIENTE");
  const beneficiarios = await cargarBeneficiarios(BigInt(sesion.usuarioId));

  const [pacientes, obrasSociales] = await Promise.all([
    prisma.paciente.findMany({
      where: { personaId: { in: beneficiarios.map((b) => BigInt(b.id)) } },
      select: { personaId: true, ...SELECCION_COBERTURA },
    }),
    prisma.obraSocial.findMany({
      where: { activa: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);
  const opciones = obrasSociales.map((os) => ({
    id: os.id.toString(),
    nombre: os.nombre,
  }));

  return (
    <div>
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1>Mi cobertura</h1>
          <p>
            Registrá la obra social de cada beneficiario para elegir «Con
            cobertura registrada» al confirmar un turno.
          </p>
        </div>
      </div>

      {beneficiarios.length === 0 ? (
        <p className="sigsam-muted">No tenés pacientes vinculados a tu cuenta.</p>
      ) : (
        beneficiarios.map((b) => {
          const paciente = pacientes.find((p) => p.personaId.toString() === b.id);
          return (
            <section
              key={b.id}
              className="sigsam-card"
              style={{ marginBottom: 16 }}
            >
              <h2 style={{ marginTop: 0 }}>
                {b.nombre}{" "}
                <span className="sigsam-muted" style={{ fontSize: 14 }}>
                  ({b.tipo})
                </span>
              </h2>
              <CoberturaForm
                pacienteId={b.id}
                obrasSociales={opciones}
                cobertura={paciente ? coberturaDe(paciente) : null}
              />
            </section>
          );
        })
      )}
    </div>
  );
}
