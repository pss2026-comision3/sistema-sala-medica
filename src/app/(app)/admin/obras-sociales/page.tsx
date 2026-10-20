import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/guards";
import { ObrasSocialesView } from "./obras-sociales-view";

export default async function AdminObrasSocialesPage() {
  await requireRole("ADMIN");

  const obrasSocialesDb = await prisma.obraSocial.findMany({
    orderBy: { nombre: "asc" },
  });

  const obrasSociales = obrasSocialesDb.map((obraSocial) => ({
    id: obraSocial.id.toString(),
    nombre: obraSocial.nombre,
    activa: obraSocial.activa,
  }));

  return (
    <>
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">Administración</div>
          <h1>Obras sociales y prepagas</h1>
          <p>
            Mantené el catálogo de entidades disponibles para registrar
            coberturas médicas.
          </p>
        </div>
      </div>

      <ObrasSocialesView iniciales={obrasSociales} />
    </>
  );
}
