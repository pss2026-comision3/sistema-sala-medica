import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Falta la variable DATABASE_URL en el entorno (.env).");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@sigsam.local")
    .trim()
    .toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "Admin@1234";
  const nombre = process.env.ADMIN_NOMBRE ?? "Administrador SIGSAM";

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    console.log(`[seed] El Admin ${email} ya existe; no se hace nada.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.persona.create({
    data: {
      nombreCompleto: nombre,
      usuario: {
        create: {
          email,
          passwordHash,
          rol: "ADMIN",
          activo: true,
          claveTemporal: true,
        },
      },
    },
    include: { usuario: true },
  });

  console.log(
    `[seed] Admin creado: ${admin.usuario?.email} (id=${admin.usuario?.id}).`,
  );
  console.log(
    `[seed] clave_temporal=${admin.usuario?.claveTemporal}. Contraseña temporal: ${password}`,
  );
  console.log("[seed] Cambiar la contraseña en el primer login (US-001 CA3).");
}

main()
  .catch((error) => {
    console.error("[seed] Error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
