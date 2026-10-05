import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/guards";
import {
  AdminParametrosView,
  type MedicoItem,
  type VacunaItem,
} from "./admin-parametros-view";

export default async function AdminParametrosPage() {
  await requireRole("ADMIN");

  const [medicosDb, vacunasDb] = await Promise.all([
    prisma.medico.findMany({
      include: {
        usuario: {
          include: {
            persona: true,
          },
        },
        especialidad: true,
      },
      orderBy: {
        usuario: {
          persona: {
            nombreCompleto: "asc",
          },
        },
      },
    }),
    prisma.vacuna.findMany({
      orderBy: {
        nombre: "asc",
      },
    }),
  ]);

  const medicos: MedicoItem[] = medicosDb.map((m) => ({
    usuarioId: m.usuarioId.toString(),
    nombre: m.usuario.persona.nombreCompleto,
    email: m.usuario.email,
    especialidad: m.especialidad?.nombre ?? "Sin especialidad",
    duracionTurnoMin: m.duracionTurnoMin,
    arancelActual: Number(m.arancelActual),
    activo: m.usuario.activo,
  }));

  const vacunas: VacunaItem[] = vacunasDb.map((v) => ({
    id: v.id.toString(),
    nombre: v.nombre,
    descripcion: v.descripcion,
    arancelActual: Number(v.arancelActual),
    umbralMinimo: v.umbralMinimo,
    activa: v.activa,
  }));

  return (
    <>
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">Administración</div>
          <h1>Duración y aranceles</h1>
          <p>
            Establecé las duraciones de turno y los aranceles particulares para
            consultas médicas y vacunatorio.
          </p>
        </div>
      </div>

      <AdminParametrosView
        medicosIniciales={medicos}
        vacunasIniciales={vacunas}
      />
    </>
  );
}
