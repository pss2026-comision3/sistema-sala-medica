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
    "[seed] Cuentas demo verificadas. Sembrando especialidades y prestaciones...",
  );

  // 1. Especialidades médicas
  const especialidadesNombres = [
    "Clínica Médica",
    "Pediatría",
    "Traumatología",
  ];
  const especialidadesMap: Record<string, bigint> = {};

  for (const nombre of especialidadesNombres) {
    const esp = await prisma.especialidad.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
    especialidadesMap[nombre] = esp.id;
    console.log(`[seed] Especialidad '${nombre}' lista (id: ${esp.id})`);
  }

  // 2. Perfil de Medico para el usuario medico demo
  const usuarioMedico = await prisma.usuario.findUnique({
    where: { email: "medico@sigsam.local" },
    include: { medico: true },
  });

  if (usuarioMedico && !usuarioMedico.medico) {
    await prisma.medico.create({
      data: {
        usuarioId: usuarioMedico.id,
        especialidadId: especialidadesMap["Clínica Médica"],
        duracionTurnoMin: 20,
        arancelActual: 5000.0,
      },
    });
    console.log(
      "[seed] Perfil médico creado para Dra. Valeria Ruiz (20 min, $5000.00)",
    );
  }

  // 3. Catálogo base de vacunas
  const vacunasBase = [
    {
      nombre: "Antigripal",
      descripcion:
        "Vacuna antigripal anual para grupos de riesgo, adultos y personal de salud.",
      umbralMinimo: 10,
      arancelActual: 0.0,
    },
    {
      nombre: "Hepatitis B",
      descripcion:
        "Inmunización activa contra la infección por el virus de la hepatitis B.",
      umbralMinimo: 10,
      arancelActual: 0.0,
    },
    {
      nombre: "Fiebre Amarilla",
      descripcion:
        "Vacuna a virus vivo atenuado para viajeros a zonas de riesgo de transmisión.",
      umbralMinimo: 5,
      arancelActual: 4500.0,
    },
    {
      nombre: "Neumococo 23",
      descripcion:
        "Vacuna antineumocócica polisacárida contra 23 serotipos de Streptococcus pneumoniae.",
      umbralMinimo: 8,
      arancelActual: 2500.0,
    },
  ];

  for (const v of vacunasBase) {
    const vacunaExistente = await prisma.vacuna.findUnique({
      where: { nombre: v.nombre },
    });
    if (!vacunaExistente) {
      await prisma.vacuna.create({
        data: {
          nombre: v.nombre,
          descripcion: v.descripcion,
          umbralMinimo: v.umbralMinimo,
          arancelActual: v.arancelActual,
          activa: true,
        },
      });
      console.log(
        `[seed] Vacuna '${v.nombre}' creada (arancel: $${v.arancelActual.toFixed(2)})`,
      );
    }
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
