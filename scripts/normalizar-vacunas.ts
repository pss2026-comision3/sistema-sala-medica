import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { normalizarNombreVacuna } from "../src/lib/validations/vacunas";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Falta la variable DATABASE_URL en el entorno (.env).");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(connectionString),
});

type CambioNombre = {
  id: bigint;
  anterior: string;
  nuevo: string;
};

async function main(): Promise<void> {
  const vacunas = await prisma.vacuna.findMany({ orderBy: { id: "asc" } });

  const cambios: CambioNombre[] = vacunas
    .map((vacuna) => ({
      id: vacuna.id,
      anterior: vacuna.nombre,
      nuevo: normalizarNombreVacuna(vacuna.nombre),
    }))
    .filter((cambio) => cambio.anterior !== cambio.nuevo);

  const porNombreCanonico = new Map<string, CambioNombre[]>();
  for (const vacuna of vacunas) {
    const canonico = normalizarNombreVacuna(vacuna.nombre);
    const grupo = porNombreCanonico.get(canonico) ?? [];
    grupo.push({
      id: vacuna.id,
      anterior: vacuna.nombre,
      nuevo: canonico,
    });
    porNombreCanonico.set(canonico, grupo);
  }

  const colisiones = [...porNombreCanonico.entries()].filter(
    ([, grupo]) => grupo.length > 1,
  );

  if (colisiones.length > 0) {
    console.error(
      "[normalizar-vacunas] Hay nombres que quedarían duplicados. No se actualizó nada:",
    );
    for (const [nombre, grupo] of colisiones) {
      console.error(
        `- ${nombre}: ${grupo
          .map((cambio) => `${cambio.anterior} (id ${cambio.id})`)
          .join(", ")}`,
      );
    }
    process.exitCode = 1;
    return;
  }

  if (cambios.length === 0) {
    console.log(
      `[normalizar-vacunas] ${vacunas.length} vacunas revisadas; no hay nombres para normalizar.`,
    );
    return;
  }

  await prisma.$transaction(
    cambios.map((cambio) =>
      prisma.vacuna.update({
        where: { id: cambio.id },
        data: { nombre: cambio.nuevo },
      }),
    ),
  );

  for (const cambio of cambios) {
    console.log(
      `[normalizar-vacunas] ${cambio.anterior} -> ${cambio.nuevo} (id ${cambio.id})`,
    );
  }
}

main()
  .catch((error) => {
    console.error("[normalizar-vacunas] Error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
