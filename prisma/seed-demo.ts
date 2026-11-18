/**
 * Seed aislado para la demo del Sprint 3 (SIGSAM).
 *
 * Regla de oro: este script SOLO crea y elimina registros identificados con el
 * namespace reservado de la demo:
 *   - usuarios:   s3.*@sigsam.local
 *   - personas:   nombre terminado en " (S3)"
 *   - pacientes:  DNI 990001xx / nombres " (S3)"
 *   - obras sociales, vacunas y especialidades: nombre terminado en " (S3)"
 *   - lotes:      código que empieza con "S3-"
 *
 * No usa TRUNCATE ni borra datos ajenos. Si ya existe un registro con el
 * namespace S3, lo considera parte de la demo y lo recicla.
 *
 * Uso:
 *   npm run demo:reset
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Falta DATABASE_URL en el entorno (.env).");
}

function hostDeBase(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "host no reconocido";
  }
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(connectionString),
});

const ZONA = "America/Argentina/Buenos_Aires";
const PASSWORD_DEMO = "12345678";
const MAX_MINUTO = 23 * 60 + 40;

function fechaSala(ahora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

function partesHoraSala(ahora = new Date()): { hora: number; minuto: number } {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(ahora);
  const valor = (tipo: "hour" | "minute") =>
    Number(partes.find((p) => p.type === tipo)?.value ?? "0");
  return { hora: valor("hour") % 24, minuto: valor("minute") };
}

function sumarDias(fecha: string, dias: number): string {
  const base = new Date(`${fecha}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

function fechaDate(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

function horaDate(hora: string): Date {
  return new Date(`1970-01-01T${hora}:00.000Z`);
}

function minutosAHora(minutos: number): string {
  const normalizado = ((minutos % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalizado / 60)).padStart(2, "0")}:${String(
    normalizado % 60,
  ).padStart(2, "0")}`;
}

function desplazarMinutos(ahora: Date, minutos: number) {
  const { hora, minuto } = partesHoraSala(ahora);
  const total = hora * 60 + minuto + minutos;
  const dias = Math.floor(total / 1440);
  const minutoDia = ((total % 1440) + 1440) % 1440;
  return {
    fecha: sumarDias(fechaSala(ahora), dias),
    minuto: minutoDia,
    hora: minutosAHora(minutoDia),
  };
}

async function limpiarDemo() {
  const demoUsuarios = await prisma.usuario.findMany({
    where: { email: { startsWith: "s3." } },
    select: { id: true, personaId: true },
  });
  const usuarioIds = demoUsuarios.map((u) => u.id);

  const demoPacientes = await prisma.paciente.findMany({
    where: {
      OR: [
        { persona: { nombreCompleto: { endsWith: " (S3)", mode: "insensitive" } } },
        { dni: { in: Array.from({ length: 20 }, (_, i) => `990001${String(i + 1).padStart(2, "0")}`) } },
      ],
    },
    select: { personaId: true },
  });
  const pacienteIds = demoPacientes.map((p) => p.personaId);

  const demoObras = await prisma.obraSocial.findMany({
    where: { nombre: { endsWith: " (S3)", mode: "insensitive" } },
    select: { id: true },
  });
  const demoVacunas = await prisma.vacuna.findMany({
    where: { nombre: { endsWith: " (S3)", mode: "insensitive" } },
    select: { id: true },
  });
  const demoEspecialidades = await prisma.especialidad.findMany({
    where: { nombre: { endsWith: " (S3)", mode: "insensitive" } },
    select: { id: true },
  });
  const demoLotes = await prisma.loteVacuna.findMany({
    where: {
      OR: [
        { codigo: { startsWith: "S3-" } },
        { vacuna: { nombre: { endsWith: " (S3)", mode: "insensitive" } } },
      ],
    },
    select: { id: true },
  });
  const loteIds = demoLotes.map((l) => l.id);
  const vacunaIds = demoVacunas.map((v) => v.id);
  const obraIds = demoObras.map((o) => o.id);
  const especialidadIds = demoEspecialidades.map((e) => e.id);

  const demoMedicos = await prisma.medico.findMany({
    where: { usuarioId: { in: usuarioIds } },
    select: { usuarioId: true },
  });
  const medicoIds = demoMedicos.map((m) => m.usuarioId);

  const demoDisponibilidades = await prisma.disponibilidad.findMany({
    where: { profesionalId: { in: usuarioIds } },
    select: { id: true },
  });
  const disponibilidadIds = demoDisponibilidades.map((d) => d.id);

  const demoTurnos = await prisma.turno.findMany({
    where: {
      OR: [
        { pacienteId: { in: pacienteIds } },
        { disponibilidadId: { in: disponibilidadIds } },
        { creadoPor: { in: usuarioIds } },
      ],
    },
    select: { id: true },
  });
  const turnoIds = demoTurnos.map((t) => t.id);

  const demoConsultas = await prisma.consulta.findMany({
    where: { OR: [{ turnoId: { in: turnoIds } }, { autorId: { in: medicoIds } }] },
    select: { turnoId: true },
  });
  const consultaIds = demoConsultas.map((c) => c.turnoId);

  const demoEventos = await prisma.eventoEmail.findMany({
    where: {
      OR: [
        { destinatarioId: { in: usuarioIds } },
        { turnoId: { in: turnoIds } },
        { vacunaId: { in: vacunaIds } },
      ],
    },
    select: { id: true },
  });
  const eventoIds = demoEventos.map((e) => e.id);

  const demoAvisos = await prisma.avisoInterno.findMany({
    where: { OR: [{ usuarioId: { in: usuarioIds } }, { turnoId: { in: turnoIds } }] },
    select: { id: true },
  });
  const avisoIds = demoAvisos.map((a) => a.id);

  const demoMovimientos = await prisma.movimientoStock.findMany({
    where: {
      OR: [
        { loteId: { in: loteIds } },
        { registradoPor: { in: usuarioIds } },
        { turnoId: { in: turnoIds } },
      ],
    },
    select: { id: true },
  });
  const movimientoIds = demoMovimientos.map((m) => m.id);

  const demoPagos = await prisma.pagoManual.findMany({
    where: { OR: [{ turnoId: { in: turnoIds } }, { registradoPor: { in: usuarioIds } }] },
    select: { id: true },
  });
  const pagoIds = demoPagos.map((p) => p.id);

  const demoComprobantes = await prisma.comprobanteTurno.findMany({
    where: { OR: [{ turnoId: { in: turnoIds } }, { generadoPor: { in: usuarioIds } }] },
    select: { id: true },
  });
  const comprobanteIds = demoComprobantes.map((c) => c.id);

  const demoCorrecciones = await prisma.correccion.findMany({
    where: { OR: [{ consultaTurnoId: { in: consultaIds } }, { autorId: { in: medicoIds } }] },
    select: { id: true },
  });
  const correccionIds = demoCorrecciones.map((c) => c.id);

  const demoAdjuntos = await prisma.adjunto.findMany({
    where: { consultaTurnoId: { in: consultaIds } },
    select: { id: true },
  });
  const adjuntoIds = demoAdjuntos.map((a) => a.id);

  // Orden explícito para respetar FKs (sin depender de cascadas).
  if (correccionIds.length) {
    await prisma.correccion.deleteMany({ where: { id: { in: correccionIds } } });
  }
  if (adjuntoIds.length) {
    await prisma.adjunto.deleteMany({ where: { id: { in: adjuntoIds } } });
  }
  if (consultaIds.length) {
    await prisma.consulta.deleteMany({ where: { turnoId: { in: consultaIds } } });
  }
  if (movimientoIds.length) {
    await prisma.movimientoStock.deleteMany({ where: { id: { in: movimientoIds } } });
  }
  if (pagoIds.length) {
    await prisma.pagoManual.deleteMany({ where: { id: { in: pagoIds } } });
  }
  if (comprobanteIds.length) {
    await prisma.comprobanteTurno.deleteMany({ where: { id: { in: comprobanteIds } } });
  }
  if (eventoIds.length) {
    await prisma.intentoEmail.deleteMany({ where: { eventoId: { in: eventoIds } } });
    await prisma.eventoEmail.deleteMany({ where: { id: { in: eventoIds } } });
  }
  if (avisoIds.length) {
    await prisma.avisoInterno.deleteMany({ where: { id: { in: avisoIds } } });
  }
  if (turnoIds.length) {
    await prisma.turno.updateMany({
      where: { id: { in: turnoIds } },
      data: { reprogramadoDesdeId: null },
    });
    await prisma.turno.deleteMany({ where: { id: { in: turnoIds } } });
  }
  if (disponibilidadIds.length) {
    await prisma.disponibilidad.deleteMany({ where: { id: { in: disponibilidadIds } } });
  }
  if (medicoIds.length) {
    await prisma.medico.deleteMany({ where: { usuarioId: { in: medicoIds } } });
  }
  if (pacienteIds.length) {
    await prisma.paciente.updateMany({
      where: { personaId: { in: pacienteIds } },
      data: { tutorId: null },
    });
    await prisma.paciente.deleteMany({ where: { personaId: { in: pacienteIds } } });
  }
  if (usuarioIds.length) {
    await prisma.sesion.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
    await prisma.auditoria.deleteMany({ where: { actorId: { in: usuarioIds } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuarioIds } } });
  }
  const personaIds = Array.from(
    new Set([...demoUsuarios.map((u) => u.personaId), ...pacienteIds]),
  );
  if (personaIds.length) {
    await prisma.persona.deleteMany({ where: { id: { in: personaIds } } });
  }
  if (loteIds.length) {
    await prisma.loteVacuna.deleteMany({ where: { id: { in: loteIds } } });
  }
  if (vacunaIds.length) {
    await prisma.vacuna.deleteMany({ where: { id: { in: vacunaIds } } });
  }
  if (especialidadIds.length) {
    await prisma.especialidad.deleteMany({ where: { id: { in: especialidadIds } } });
  }
  if (obraIds.length) {
    await prisma.obraSocial.deleteMany({ where: { id: { in: obraIds } } });
  }

  console.log(
    `[demo] Limpieza S3: ${usuarioIds.length} usuarios, ${pacienteIds.length} pacientes, ` +
      `${turnoIds.length} turnos, ${vacunaIds.length} vacunas, ${obraIds.length} obras sociales.`,
  );
}

async function crearCuenta(
  nombreCompleto: string,
  email: string,
  rol: "ADMIN" | "MEDICO" | "ENFERMERIA" | "PACIENTE",
  passwordHash: string,
) {
  const persona = await prisma.persona.create({
    data: { nombreCompleto: `${nombreCompleto} (S3)` },
  });
  const usuario = await prisma.usuario.create({
    data: {
      personaId: persona.id,
      email,
      passwordHash,
      rol,
      activo: true,
      claveTemporal: false,
    },
  });
  return { persona, usuario };
}

async function crearPaciente(
  personaId: bigint,
  dni: string,
  fechaNacimiento: string,
  telefono: string,
  extra: {
    tutorId?: bigint | null;
    obraSocialId?: bigint | null;
    plan?: string | null;
    numeroAfiliado?: string | null;
  } = {},
) {
  return prisma.paciente.create({
    data: {
      personaId,
      dni,
      fechaNacimiento: fechaDate(fechaNacimiento),
      telefono,
      tutorId: extra.tutorId ?? null,
      obraSocialId: extra.obraSocialId ?? null,
      plan: extra.plan ?? null,
      numeroAfiliado: extra.numeroAfiliado ?? null,
    },
  });
}

async function crearBloque(
  profesionalId: bigint,
  fecha: string,
  desde: string,
  hasta: string,
  suspendida = false,
  suspendidaPor?: bigint,
) {
  return prisma.disponibilidad.create({
    data: {
      profesionalId,
      fecha: fechaDate(fecha),
      horaDesde: horaDate(desde),
      horaHasta: horaDate(hasta),
      estado: suspendida ? "SUSPENDIDA" : "PUBLICADA",
      motivoSuspension: suspendida ? "Capacitación del profesional (S3)" : null,
      suspendidaEn: suspendida ? new Date() : null,
      suspendidaPor: suspendida ? (suspendidaPor ?? null) : null,
    },
  });
}

type TurnoDemo = {
  pacienteId: bigint;
  disponibilidadId: bigint;
  hora: string;
  creadoPor: bigint;
  tipo?: "CONSULTA" | "VACUNACION";
  vacunaId?: bigint | null;
  loteReservadoId?: bigint | null;
  arancel?: number;
  modalidad?: "PARTICULAR" | "CON_COBERTURA";
  obraSocialId?: bigint | null;
  coberturaNombreSnapshot?: string | null;
  coberturaPlanSnapshot?: string | null;
  afiliadoSnapshot?: string | null;
  estado?: "RESERVADO" | "CONFIRMADO" | "CANCELADO";
  resultado?: "SIN_REGISTRAR" | "ATENDIDO" | "AUSENTE";
  atendidoEn?: Date | null;
  canceladoEn?: Date | null;
  canceladoPor?: bigint | null;
  origenCancelacion?: string | null;
  motivoCancelacion?: string | null;
  reprogramadoDesdeId?: bigint | null;
  creadoEn?: Date;
};

async function crearTurno(data: TurnoDemo) {
  return prisma.turno.create({
    data: {
      pacienteId: data.pacienteId,
      disponibilidadId: data.disponibilidadId,
      creadoPor: data.creadoPor,
      tipo: data.tipo ?? "CONSULTA",
      vacunaId: data.vacunaId ?? null,
      loteReservadoId: data.loteReservadoId ?? null,
      hora: horaDate(data.hora),
      duracionMin: 20,
      arancel: data.arancel ?? 5000,
      modalidad: data.modalidad ?? "PARTICULAR",
      obraSocialId: data.obraSocialId ?? null,
      coberturaNombreSnapshot: data.coberturaNombreSnapshot ?? null,
      coberturaPlanSnapshot: data.coberturaPlanSnapshot ?? null,
      afiliadoSnapshot: data.afiliadoSnapshot ?? null,
      estado: data.estado ?? "CONFIRMADO",
      resultado: data.resultado ?? "SIN_REGISTRAR",
      atendidoEn: data.atendidoEn ?? null,
      canceladoEn: data.canceladoEn ?? null,
      canceladoPor: data.canceladoPor ?? null,
      origenCancelacion: data.origenCancelacion ?? null,
      motivoCancelacion: data.motivoCancelacion ?? null,
      reprogramadoDesdeId: data.reprogramadoDesdeId ?? null,
      creadoEn: data.creadoEn ?? new Date(),
    },
  });
}

async function crearConsulta(
  turnoId: bigint,
  autorId: bigint,
  diagnostico: string,
  creadaEn: Date,
) {
  return prisma.consulta.create({
    data: { turnoId, autorId, diagnostico, creadaEn },
  });
}

async function crearRecordatorio(
  turnoId: bigint,
  destinatarioId: bigint,
  emailDestino: string,
  programadoEn: Date,
  prestacion: string,
  resultado: "EXITO" | "FALLIDO",
) {
  const evento = await prisma.eventoEmail.create({
    data: {
      destinatarioId,
      turnoId,
      tipoEvento: "RECORDATORIO",
      claveEvento: `RECORDATORIO:turno:${turnoId}`,
      emailDestinoSnapshot: emailDestino,
      asunto: "Recordatorio de turno",
      cuerpo: `Recordatorio: tenés un turno de ${prestacion} programado.`,
      programadoEn,
      creadoEn: programadoEn,
    },
  });
  await prisma.intentoEmail.create({
    data: {
      eventoId: evento.id,
      numero: 1,
      resultado,
      error: resultado === "FALLIDO" ? "SMTP simulado: destinatario inaccesible" : null,
      intentadoEn: programadoEn,
    },
  });
  return evento;
}

async function crearAvisoRecordatorio(
  usuarioId: bigint,
  turnoId: bigint,
  resumen: string,
  creadoEn: Date,
) {
  return prisma.avisoInterno.create({
    data: {
      usuarioId,
      turnoId,
      evento: "Recordatorio de turno",
      resumen,
      leido: false,
      creadoEn,
    },
  });
}

async function main() {
  const ahora = new Date();
  const hoy = fechaSala(ahora);
  const { hora: horaActual, minuto: minutoActual } = partesHoraSala(ahora);
  const minutoAhora = horaActual * 60 + minutoActual;

  console.log(`[demo] Fecha/hora de sala: ${hoy} ${minutosAHora(minutoAhora)}`);
  console.log(`[demo] Base destino: ${hostDeBase(connectionString!)}`);
  console.log("[demo] Se eliminarán únicamente registros del namespace S3.");
  console.log("[demo] Limpiando únicamente registros del namespace S3...");
  await limpiarDemo();

  const passwordHash = await bcrypt.hash(PASSWORD_DEMO, 10);

  const admin = await crearCuenta(
    "Administrador Demo",
    "s3.admin1@sigsam.local",
    "ADMIN",
    passwordHash,
  );
  const medico1 = await crearCuenta(
    "Dra. Valeria Ruiz",
    "s3.medico1@sigsam.local",
    "MEDICO",
    passwordHash,
  );
  const medico2 = await crearCuenta(
    "Dr. Hernán Salas",
    "s3.medico2@sigsam.local",
    "MEDICO",
    passwordHash,
  );
  const enfermeria = await crearCuenta(
    "Paula Medina",
    "s3.enfermeria1@sigsam.local",
    "ENFERMERIA",
    passwordHash,
  );
  const paciente1 = await crearCuenta(
    "Juan Pérez",
    "s3.paciente1@sigsam.local",
    "PACIENTE",
    passwordHash,
  );
  const tutor1 = await crearCuenta(
    "María González",
    "s3.tutor1@sigsam.local",
    "PACIENTE",
    passwordHash,
  );
  const paciente2 = await crearCuenta(
    "Elena Díaz",
    "s3.paciente2@sigsam.local",
    "PACIENTE",
    passwordHash,
  );
  const paciente3 = await crearCuenta(
    "Ana Torres",
    "s3.paciente3@sigsam.local",
    "PACIENTE",
    passwordHash,
  );

  const especialidad = await prisma.especialidad.create({
    data: { nombre: "Clínica Médica (S3)" },
  });

  await prisma.medico.create({
    data: {
      usuarioId: medico1.usuario.id,
      especialidadId: especialidad.id,
      duracionTurnoMin: 20,
      arancelActual: 5000,
    },
  });
  await prisma.medico.create({
    data: {
      usuarioId: medico2.usuario.id,
      especialidadId: especialidad.id,
      duracionTurnoMin: 20,
      arancelActual: 6000,
    },
  });

  const osde = await prisma.obraSocial.create({
    data: { nombre: "OSDE (S3)", activa: true },
  });
  const ioma = await prisma.obraSocial.create({
    data: { nombre: "IOMA (S3)", activa: true },
  });
  const accord = await prisma.obraSocial.create({
    data: { nombre: "Accord (S3)", activa: false },
  });

  const juan = await crearPaciente(
    paciente1.persona.id,
    "99000101",
    "1985-07-20",
    "11-5555-0101",
    {
      obraSocialId: osde.id,
      plan: "210",
      numeroAfiliado: "S3-OSDE-001",
    },
  );
  const maria = await crearPaciente(
    tutor1.persona.id,
    "99000102",
    "1988-03-12",
    "11-5555-0102",
  );
  const tomas = await crearPaciente(
    (
      await prisma.persona.create({
        data: { nombreCompleto: "Tomás González (S3)" },
      })
    ).id,
    "99000103",
    "2015-05-10",
    "11-5555-0103",
    { tutorId: maria.personaId },
  );
  const lucia = await crearPaciente(
    (
      await prisma.persona.create({
        data: { nombreCompleto: "Lucía Fernández (S3)" },
      })
    ).id,
    "99000104",
    "1992-11-03",
    "11-5555-0104",
    {
      obraSocialId: accord.id,
      plan: "Accord 100",
      numeroAfiliado: "S3-ACC-004",
    },
  );
  const pedro = await crearPaciente(
    (
      await prisma.persona.create({
        data: { nombreCompleto: "Pedro Gómez (S3)" },
      })
    ).id,
    "99000105",
    "1979-01-15",
    "11-5555-0105",
  );
  const elena = await crearPaciente(
    paciente2.persona.id,
    "99000106",
    "1990-09-22",
    "11-5555-0106",
    {
      obraSocialId: ioma.id,
      plan: "IOMA 200",
      numeroAfiliado: "S3-IOMA-006",
    },
  );
  const roberto = await crearPaciente(
    (
      await prisma.persona.create({
        data: { nombreCompleto: "Roberto Silva (S3)" },
      })
    ).id,
    "99000107",
    "1975-04-08",
    "11-5555-0107",
  );
  const ana = await crearPaciente(
    paciente3.persona.id,
    "99000108",
    "1995-12-30",
    "11-5555-0108",
    {
      obraSocialId: ioma.id,
      plan: "IOMA 200",
      numeroAfiliado: "S3-IOMA-008",
    },
  );
  const carlos = await crearPaciente(
    (
      await prisma.persona.create({
        data: { nombreCompleto: "Carlos Ríos (S3)" },
      })
    ).id,
    "99000109",
    "1983-06-18",
    "11-5555-0109",
  );

  // D1 + D6 + cron: bloque de hoy/días próximos alrededor de la hora actual.
  const d1Minuto = Math.max(0, minutoAhora - 10);
  const d6 = desplazarMinutos(ahora, 2 * 60);
  const d6cron = desplazarMinutos(ahora, 4 * 60);

  const bloquesPorFecha = new Map<string, { min: number; max: number }>();
  const agregarBloque = (fecha: string, minuto: number) => {
    const actual = bloquesPorFecha.get(fecha);
    bloquesPorFecha.set(fecha, {
      min: Math.min(actual?.min ?? minuto, minuto),
      max: Math.max(actual?.max ?? minuto, minuto),
    });
  };
  agregarBloque(hoy, d1Minuto);
  agregarBloque(d6.fecha, d6.minuto);
  agregarBloque(d6cron.fecha, d6cron.minuto);

  const bloquesCercanos = new Map<string, Awaited<ReturnType<typeof crearBloque>>>();
  for (const [fecha, rango] of bloquesPorFecha) {
    const desde = Math.max(0, Math.min(MAX_MINUTO, rango.min - 20));
    const hasta = Math.max(desde + 20, Math.min(MAX_MINUTO, rango.max + 40));
    bloquesCercanos.set(
      fecha,
      await crearBloque(medico1.usuario.id, fecha, minutosAHora(desde), minutosAHora(hasta)),
    );
  }

  const d1 = await crearTurno({
    pacienteId: juan.personaId,
    disponibilidadId: bloquesCercanos.get(hoy)!.id,
    hora: minutosAHora(d1Minuto),
    creadoPor: admin.usuario.id,
    modalidad: "CON_COBERTURA",
    obraSocialId: osde.id,
    coberturaNombreSnapshot: osde.nombre,
    coberturaPlanSnapshot: "210",
    afiliadoSnapshot: "S3-OSDE-001",
    arancel: 5000,
  });

  const d6Turno = await crearTurno({
    pacienteId: juan.personaId,
    disponibilidadId: bloquesCercanos.get(d6.fecha)!.id,
    hora: d6.hora,
    creadoPor: admin.usuario.id,
    modalidad: "CON_COBERTURA",
    obraSocialId: osde.id,
    coberturaNombreSnapshot: osde.nombre,
    coberturaPlanSnapshot: "210",
    afiliadoSnapshot: "S3-OSDE-001",
    arancel: 5000,
  });

  // Turno que el cron debe recordar (sin aviso previo). Queda para la prueba real del cron.
  await crearTurno({
    pacienteId: maria.personaId,
    disponibilidadId: bloquesCercanos.get(d6cron.fecha)!.id,
    hora: d6cron.hora,
    creadoPor: admin.usuario.id,
    arancel: 5000,
  });

  // D2: cita de ayer, confirmada, sin consulta. Se usa para registrar ausencia.
  const ayer = sumarDias(hoy, -1);
  const bloqueAyer = await crearBloque(medico1.usuario.id, ayer, "09:00", "12:00");
  await crearTurno({
    pacienteId: juan.personaId,
    disponibilidadId: bloqueAyer.id,
    hora: "09:00",
    creadoPor: admin.usuario.id,
    modalidad: "CON_COBERTURA",
    obraSocialId: osde.id,
    coberturaNombreSnapshot: osde.nombre,
    coberturaPlanSnapshot: "210",
    afiliadoSnapshot: "S3-OSDE-001",
  });

  // D3 / D9: consulta histórica del médico logueado, con cobertura.
  const hace7 = sumarDias(hoy, -7);
  const bloque7 = await crearBloque(medico1.usuario.id, hace7, "09:00", "12:00");
  const turnoJuan7 = await crearTurno({
    pacienteId: juan.personaId,
    disponibilidadId: bloque7.id,
    hora: "10:00",
    creadoPor: admin.usuario.id,
    modalidad: "CON_COBERTURA",
    obraSocialId: osde.id,
    coberturaNombreSnapshot: osde.nombre,
    coberturaPlanSnapshot: "210",
    afiliadoSnapshot: "S3-OSDE-001",
    resultado: "ATENDIDO",
    atendidoEn: new Date(`${hace7}T13:15:00.000Z`),
    creadoEn: new Date(`${hace7}T13:00:00.000Z`),
  });
  await crearConsulta(
    turnoJuan7.id,
    medico1.usuario.id,
    "Control de presión arterial. Paciente estable (S3).",
    new Date(`${hace7}T13:15:00.000Z`),
  );
  await crearRecordatorio(
    turnoJuan7.id,
    paciente1.usuario.id,
    "s3.paciente1@sigsam.local",
    new Date(`${hace7}T13:00:00.000Z`),
    "Clínica Médica (S3)",
    "EXITO",
  );

  // D4: historial de la tutora y del menor (fuera de la ventana de reportes).
  const hace40 = sumarDias(hoy, -40);
  const bloque40 = await crearBloque(medico1.usuario.id, hace40, "09:00", "12:00");
  const turnoMaria = await crearTurno({
    pacienteId: maria.personaId,
    disponibilidadId: bloque40.id,
    hora: "10:00",
    creadoPor: admin.usuario.id,
    resultado: "ATENDIDO",
    atendidoEn: new Date(`${hace40}T13:15:00.000Z`),
    creadoEn: new Date(`${hace40}T13:00:00.000Z`),
  });
  await crearConsulta(
    turnoMaria.id,
    medico1.usuario.id,
    "Control ginecológico anual (S3).",
    new Date(`${hace40}T13:15:00.000Z`),
  );

  const hace39 = sumarDias(hoy, -39);
  const bloque39 = await crearBloque(medico1.usuario.id, hace39, "09:00", "12:00");
  const turnoTomas = await crearTurno({
    pacienteId: tomas.personaId,
    disponibilidadId: bloque39.id,
    hora: "10:00",
    creadoPor: admin.usuario.id,
    resultado: "ATENDIDO",
    atendidoEn: new Date(`${hace39}T13:15:00.000Z`),
    creadoEn: new Date(`${hace39}T13:00:00.000Z`),
  });
  await crearConsulta(
    turnoTomas.id,
    medico1.usuario.id,
    "Control pediátrico. Vacunación al día (S3).",
    new Date(`${hace39}T13:15:00.000Z`),
  );

  // D4/D7: paciente no vinculada, cobertura inactiva e histórico.
  const hace41 = sumarDias(hoy, -41);
  const bloque41 = await crearBloque(medico1.usuario.id, hace41, "09:00", "12:00");
  await crearTurno({
    pacienteId: lucia.personaId,
    disponibilidadId: bloque41.id,
    hora: "10:00",
    creadoPor: admin.usuario.id,
    estado: "CANCELADO",
    canceladoEn: new Date(`${hace41}T12:00:00.000Z`),
    canceladoPor: admin.usuario.id,
    motivoCancelacion: "Reprogramación solicitada por la paciente (S3).",
    origenCancelacion: "demo",
    modalidad: "CON_COBERTURA",
    obraSocialId: accord.id,
    coberturaNombreSnapshot: accord.nombre,
    coberturaPlanSnapshot: "Accord 100",
    afiliadoSnapshot: "S3-ACC-004",
  });

  // D5: jornada suspendida de Dr. Salas, con dos citas confirmadas.
  const manana = sumarDias(hoy, 1);
  const bloqueSalas = await crearBloque(
    medico2.usuario.id,
    manana,
    "09:00",
    "11:00",
    true,
    admin.usuario.id,
  );
  await crearTurno({
    pacienteId: juan.personaId,
    disponibilidadId: bloqueSalas.id,
    hora: "09:00",
    creadoPor: admin.usuario.id,
    modalidad: "CON_COBERTURA",
    obraSocialId: osde.id,
    coberturaNombreSnapshot: osde.nombre,
    coberturaPlanSnapshot: "210",
    afiliadoSnapshot: "S3-OSDE-001",
  });
  await crearTurno({
    pacienteId: lucia.personaId,
    disponibilidadId: bloqueSalas.id,
    hora: "09:20",
    creadoPor: admin.usuario.id,
    modalidad: "CON_COBERTURA",
    obraSocialId: accord.id,
    coberturaNombreSnapshot: accord.nombre,
    coberturaPlanSnapshot: "Accord 100",
    afiliadoSnapshot: "S3-ACC-004",
  });

  // D5: Dr. Ruiz con un horario ocupado y uno libre para reprogramar.
  const enDosDias = sumarDias(hoy, 2);
  const bloqueRuiz = await crearBloque(medico1.usuario.id, enDosDias, "10:00", "12:00");
  await crearTurno({
    pacienteId: pedro.personaId,
    disponibilidadId: bloqueRuiz.id,
    hora: "10:00",
    creadoPor: admin.usuario.id,
    arancel: 5000,
  });

  // D9: historia para reportes (todos consulta, dentro de los últimos 30 días).
  const hace8 = sumarDias(hoy, -8);
  const bloque8 = await crearBloque(medico1.usuario.id, hace8, "09:00", "12:00");
  const turnoPedro = await crearTurno({
    pacienteId: pedro.personaId,
    disponibilidadId: bloque8.id,
    hora: "10:00",
    creadoPor: admin.usuario.id,
    resultado: "ATENDIDO",
    atendidoEn: new Date(`${hace8}T13:15:00.000Z`),
    creadoEn: new Date(`${hace8}T13:00:00.000Z`),
    arancel: 5000,
  });
  await crearConsulta(
    turnoPedro.id,
    medico1.usuario.id,
    "Lumbalgia mecánica. Indicaciones y analgesia (S3).",
    new Date(`${hace8}T13:15:00.000Z`),
  );

  const hace9 = sumarDias(hoy, -9);
  const bloque9 = await crearBloque(medico1.usuario.id, hace9, "09:00", "12:00");
  const turnoElena = await crearTurno({
    pacienteId: elena.personaId,
    disponibilidadId: bloque9.id,
    hora: "10:00",
    creadoPor: admin.usuario.id,
    resultado: "ATENDIDO",
    atendidoEn: new Date(`${hace9}T13:15:00.000Z`),
    creadoEn: new Date(`${hace9}T13:00:00.000Z`),
    arancel: 0,
  });
  await crearConsulta(
    turnoElena.id,
    medico1.usuario.id,
    "Control de salud. Sin cargo por convenio (S3).",
    new Date(`${hace9}T13:15:00.000Z`),
  );

  const hace6 = sumarDias(hoy, -6);
  const bloque6 = await crearBloque(medico1.usuario.id, hace6, "09:00", "12:00");
  const turnoRoberto = await crearTurno({
    pacienteId: roberto.personaId,
    disponibilidadId: bloque6.id,
    hora: "10:00",
    creadoPor: admin.usuario.id,
    resultado: "AUSENTE",
    creadoEn: new Date(`${hace6}T13:00:00.000Z`),
    arancel: 5000,
  });
  await crearRecordatorio(
    turnoRoberto.id,
    paciente1.usuario.id,
    "roberto.silva@example.com",
    new Date(`${hace6}T13:00:00.000Z`),
    "Clínica Médica (S3)",
    "FALLIDO",
  );

  const hace5 = sumarDias(hoy, -5);
  const bloque5 = await crearBloque(medico1.usuario.id, hace5, "09:00", "12:00");
  await crearTurno({
    pacienteId: ana.personaId,
    disponibilidadId: bloque5.id,
    hora: "10:00",
    creadoPor: admin.usuario.id,
    resultado: "SIN_REGISTRAR",
    creadoEn: new Date(`${hace5}T13:00:00.000Z`),
    arancel: 5000,
  });

  const carlosMinuto = Math.min(
    MAX_MINUTO,
    Math.ceil((minutoAhora + 180) / 20) * 20,
  );
  const carlosSlot = desplazarMinutos(
    ahora,
    Math.max(10, carlosMinuto - minutoAhora),
  );
  const bloqueCarlos = await crearBloque(
    medico1.usuario.id,
    carlosSlot.fecha,
    carlosSlot.hora,
    minutosAHora(Math.min(carlosSlot.minuto + 20, 23 * 60 + 59)),
  );
  await crearTurno({
    pacienteId: carlos.personaId,
    disponibilidadId: bloqueCarlos.id,
    hora: carlosSlot.hora,
    creadoPor: admin.usuario.id,
    estado: "CANCELADO",
    canceladoEn: new Date(`${sumarDias(hoy, -1)}T18:00:00.000Z`),
    canceladoPor: admin.usuario.id,
    motivoCancelacion: "El paciente no puede asistir (S3).",
    origenCancelacion: "demo",
    creadoEn: new Date(`${sumarDias(hoy, -2)}T13:00:00.000Z`),
    arancel: 5000,
  });

  // D8: vacunas, lotes y movimientos iniciales.
  const antigripal = await prisma.vacuna.create({
    data: {
      nombre: "Antigripal (S3)",
      descripcion: "Campaña antigripal 2026 (S3).",
      umbralMinimo: 10,
      arancelActual: 0,
    },
  });
  const hepatitis = await prisma.vacuna.create({
    data: {
      nombre: "Hepatitis B (S3)",
      descripcion: "Esquema de Hepatitis B (S3).",
      umbralMinimo: 10,
      arancelActual: 0,
    },
  });
  const fiebre = await prisma.vacuna.create({
    data: {
      nombre: "Fiebre Amarilla (S3)",
      descripcion: "Vacuna internacional (S3).",
      umbralMinimo: 5,
      arancelActual: 4500,
    },
  });
  const neumococo = await prisma.vacuna.create({
    data: {
      nombre: "Neumococo 23 (S3)",
      descripcion: "Prevención de neumonía (S3).",
      umbralMinimo: 8,
      arancelActual: 2500,
    },
  });
  const varicela = await prisma.vacuna.create({
    data: {
      nombre: "Varicela (S3)",
      descripcion: "Vacuna varicela (S3).",
      umbralMinimo: 5,
      arancelActual: 0,
    },
  });

  const vencimiento = sumarDias(hoy, 240);
  const loteAntA = await prisma.loteVacuna.create({
    data: {
      vacunaId: antigripal.id,
      codigo: "S3-ANT-2026-A",
      fechaVencimiento: fechaDate(vencimiento),
    },
  });
  const loteAntB = await prisma.loteVacuna.create({
    data: {
      vacunaId: antigripal.id,
      codigo: "S3-ANT-2026-B",
      fechaVencimiento: fechaDate(sumarDias(hoy, 150)),
    },
  });
  const loteHep = await prisma.loteVacuna.create({
    data: {
      vacunaId: hepatitis.id,
      codigo: "S3-HEP-2026-A",
      fechaVencimiento: fechaDate(vencimiento),
    },
  });
  const loteFam = await prisma.loteVacuna.create({
    data: {
      vacunaId: fiebre.id,
      codigo: "S3-FAM-2026-A",
      fechaVencimiento: fechaDate(sumarDias(hoy, 90)),
    },
  });
  const loteNeu = await prisma.loteVacuna.create({
    data: {
      vacunaId: neumococo.id,
      codigo: "S3-NEU-2026-A",
      fechaVencimiento: fechaDate(vencimiento),
    },
  });
  const loteVar = await prisma.loteVacuna.create({
    data: {
      vacunaId: varicela.id,
      codigo: "S3-VAR-2026-A",
      fechaVencimiento: fechaDate(sumarDias(hoy, 120)),
    },
  });

  const cargar = async (loteId: bigint, cantidad: number, diasAtras: number) =>
    prisma.movimientoStock.create({
      data: {
        loteId,
        registradoPor: enfermeria.usuario.id,
        tipo: "AJUSTE",
        cantidad,
        motivo: "Carga inicial de demo (S3)",
        creadoEn: new Date(`${sumarDias(hoy, -diasAtras)}T13:00:00.000Z`),
      },
    });

  await cargar(loteAntA.id, 8, 20);
  await cargar(loteAntB.id, 5, 18);
  await cargar(loteHep.id, 15, 20);
  await cargar(loteFam.id, 3, 19);
  await cargar(loteNeu.id, 9, 17);
  await cargar(loteVar.id, 5, 16);
  await cargar(loteVar.id, -5, 15);

  // Recordatorio ya generado para D6 (visible sin depender del cron).
  await crearRecordatorio(
    d6Turno.id,
    paciente1.usuario.id,
    "s3.paciente1@sigsam.local",
    new Date(ahora.getTime() - 60 * 60 * 1000),
    "Clínica Médica (S3)",
    "EXITO",
  );
  await crearAvisoRecordatorio(
    paciente1.usuario.id,
    d6Turno.id,
    `Recordatorio: tenés un turno de Clínica Médica (S3) programado para el ${d6.fecha} a las ${d6.hora} hs.`,
    new Date(ahora.getTime() - 60 * 60 * 1000),
  );

  console.log("[demo] Listo. Cuentas (password 12345678):");
  for (const cuenta of [
    ["Administrador", "s3.admin1@sigsam.local"],
    ["Médico 1", "s3.medico1@sigsam.local"],
    ["Médico 2", "s3.medico2@sigsam.local"],
    ["Enfermería", "s3.enfermeria1@sigsam.local"],
    ["Paciente 1 (Juan)", "s3.paciente1@sigsam.local"],
    ["Paciente 2 (Elena)", "s3.paciente2@sigsam.local"],
    ["Paciente 3 (Ana)", "s3.paciente3@sigsam.local"],
    ["Tutora (María)", "s3.tutor1@sigsam.local"],
  ]) {
    console.log(`  - ${cuenta[0]}: ${cuenta[1]} / ${PASSWORD_DEMO}`);
  }
  console.log(
    `[demo] D1 turno ${d1.id} hoy ${minutosAHora(d1Minuto)}; D6 turno ${d6Turno.id} ${d6.fecha} ${d6.hora}; cron ${d6cron.fecha} ${d6cron.hora}.`,
  );
  console.log(
    `[demo] IDs de pacientes: Juan=${juan.personaId}, María=${maria.personaId}, Tomás=${tomas.personaId}, ` +
      `Lucía=${lucia.personaId}, Pedro=${pedro.personaId}, Elena=${elena.personaId}, ` +
      `Roberto=${roberto.personaId}, Ana=${ana.personaId}, Carlos=${carlos.personaId}.`,
  );
}

main()
  .catch((error) => {
    console.error("[demo] Error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
