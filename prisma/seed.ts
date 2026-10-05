import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Falta la variable DATABASE_URL en el entorno (.env).");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(connectionString),
});

type DemoUser = {
  email: string;
  password: string;
  rol: "ADMIN" | "MEDICO" | "ENFERMERIA" | "PACIENTE";
  claveTemporal: boolean;
  nombreCompleto: string;
};

const DEMO_USERS: DemoUser[] = [
  {
    email: "admin@sigsam.local",
    password: "Admin@1234",
    rol: "ADMIN",
    claveTemporal: true,
    nombreCompleto: "Administrador SIGSAM",
  },
  {
    email: "medico@sigsam.local",
    password: "Medico@1234",
    rol: "MEDICO",
    claveTemporal: false,
    nombreCompleto: "Dra. Valeria Ruiz",
  },
  {
    email: "enfermeria@sigsam.local",
    password: "Enfermeria@1234",
    rol: "ENFERMERIA",
    claveTemporal: false,
    nombreCompleto: "Paula Medina",
  },
  {
    email: "paciente@sigsam.local",
    password: "Paciente@1234",
    rol: "PACIENTE",
    claveTemporal: true,
    nombreCompleto: "Juan Pérez",
  },
];

async function seedDemoUser(input: DemoUser): Promise<string> {
  const existente = await prisma.usuario.findUnique({
    where: { email: input.email },
  });

  if (existente) {
    return `ya existe`;
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  await prisma.persona.create({
    data: {
      nombreCompleto: input.nombreCompleto,
      usuario: {
        create: {
          email: input.email,
          passwordHash,
          rol: input.rol,
          activo: true,
          claveTemporal: input.claveTemporal,
        },
      },
    },
  });

  return `creado`;
}

async function main(): Promise<void> {
  for (const user of DEMO_USERS) {
    const resultado = await seedDemoUser(user);
    const clave = user.claveTemporal ? "clave temporal" : "clave propia";
    console.log(
      `[seed] ${user.rol.padEnd(10)} ${user.email} (${clave}) -> ${resultado}`,
    );
  }

  console.log(
    "[seed] Listo. Las credenciales de demo están en docs/SUPABASE.md y en el README.",
  );
}

main()
  .catch((error) => {
    console.error("[seed] Error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
