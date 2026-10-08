import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/guards";
import { AltaPacienteForm, type ObraSocialItem } from "./alta-paciente-form";

export default async function AdminPacientesPage() {
  // Lógica de seguridad de tu compañera
  await requireRole("ADMIN");

  // Fecha máxima seleccionable: hoy, según la hora de la sala (Argentina).
  const fechaMaxima = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  // Lógica de base de datos de tu compañera
  const [obrasSocialesDb, pacientesDb] = await Promise.all([
    prisma.obraSocial.findMany({
      where: { activa: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.paciente.findMany({
      include: {
        persona: { include: { usuario: { select: { email: true } } } },
        tutor: { include: { persona: true } },
      },
      orderBy: { persona: { nombreCompleto: "asc" } },
    }),
  ]);

  const obrasSociales: ObraSocialItem[] = obrasSocialesDb.map((os) => ({
    id: os.id.toString(),
    nombre: os.nombre,
  }));

  return (
    <>
      {/* Cabecera fusionada: Tus estilos flex + Textos de ella + Tu botón */}
      <div className="sigsam-page-head flex justify-between items-center">
        <div>
          <div className="sigsam-eyebrow">Administración</div>
          <h1>Alta asistida</h1>
          <p>
            Registrá a una persona adulta y entregale sus credenciales
            temporales para el primer ingreso.
          </p>
        </div>
        
        {/* Tu botón hacia la User Story del menor */}
        <div>
          <Link 
            href="/admin/pacientes/nuevo-menor" 
            className="bg-teal-700 !text-white px-4 py-2 rounded-md hover:bg-teal-800 transition-colors font-medium shadow-sm inline-block"
          >
            + Registrar Menor
          </Link>
        </div>
      </div>

      {/* Formulario de adulto que hizo tu compañera */}
      <section className="sigsam-card" style={{ marginBottom: 28 }}>
        <h2>Registrar paciente adulto</h2>
        <AltaPacienteForm
          obrasSociales={obrasSociales}
          fechaMaxima={fechaMaxima}
        />
      </section>

      {/* Listado de pacientes reales que hizo tu compañera */}
      <section className="sigsam-card">
        <h2>Pacientes registrados</h2>
        {pacientesDb.length === 0 ? (
          <p className="sigsam-muted">Todavía no hay pacientes registrados.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {pacientesDb.map((p) => (
              <li
                key={p.personaId.toString()}
                style={{
                  padding: "12px 0",
                  borderBottom: "1px solid var(--color-border, #d7e2e4)",
                }}
              >
                <strong>{p.persona.nombreCompleto}</strong>
                <span className="sigsam-muted" style={{ display: "block" }}>
                  DNI {p.dni} ·{" "}
                  {p.tutor
                    ? `Tutor: ${p.tutor.persona.nombreCompleto}`
                    : "Persona adulta"}
                  {p.persona.usuario
                    ? ` · ${p.persona.usuario.email}`
                    : " · Sin cuenta"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}