import { prisma } from "@/lib/db/prisma";

const ZONA_SALA = "America/Argentina/Buenos_Aires";
const DIA_MS = 86_400_000;

export type FiltrosHorarios = {
  beneficiario?: string;
  especialidad?: string;
  medico?: string;
  fecha?: string;
};

export type HorarioConsulta = {
  clave: string;
  disponibilidadId: string;
  medico: string;
  especialidad: string;
  fecha: string;
  hora: string;
  duracionMin: number;
  arancel: string;
  superpuesto: boolean;
};

function partesSala(fecha: Date) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA_SALA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(fecha);
  const valor = (tipo: string) =>
    partes.find((p) => p.type === tipo)?.value ?? "00";
  return `${valor("year")}-${valor("month")}-${valor("day")}T${valor("hour")}:${valor("minute")}:${valor("second")}`;
}

export function hoySala(ahora = new Date()) {
  return partesSala(ahora).slice(0, 10);
}

function fechaDb(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function sumarDias(iso: string, dias: number) {
  return new Date(fechaDb(iso).getTime() + dias * DIA_MS)
    .toISOString()
    .slice(0, 10);
}

export function fechaIsoValida(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const fecha = fechaDb(iso);
  return (
    !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === iso
  );
}

function minutos(hora: Date) {
  return hora.getUTCHours() * 60 + hora.getUTCMinutes();
}

function aHora(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function ocupa(estado: string, retenidoHasta: Date | null, ahora: Date) {
  return (
    estado === "CONFIRMADO" ||
    (estado === "RESERVADO" && !!retenidoHasta && retenidoHasta > ahora)
  );
}

export async function cargarBeneficiarios(
  usuarioId: bigint,
  ahora = new Date(),
) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { personaId: true },
  });
  if (!usuario) return [];
  const usuarioPersonaId = usuario.personaId;
  const hoy = hoySala(ahora);
  const limiteAdultez = `${Number(hoy.slice(0, 4)) - 18}${hoy.slice(4)}`;
  const [titular, menores] = await Promise.all([
    prisma.paciente.findUnique({
      where: { personaId: usuarioPersonaId },
      select: {
        personaId: true,
        persona: { select: { nombreCompleto: true } },
      },
    }),
    prisma.paciente.findMany({
      where: {
        tutorId: usuarioPersonaId,
        fechaNacimiento: { gt: fechaDb(limiteAdultez) },
      },
      select: {
        personaId: true,
        persona: { select: { nombreCompleto: true } },
      },
      orderBy: { persona: { nombreCompleto: "asc" } },
    }),
  ]);

  return [
    ...(titular
      ? [
          {
            id: titular.personaId.toString(),
            nombre: titular.persona.nombreCompleto,
            tipo: "Titular",
          },
        ]
      : []),
    ...menores.map((menor) => ({
      id: menor.personaId.toString(),
      nombre: menor.persona.nombreCompleto,
      tipo: "Menor a cargo",
    })),
  ];
}

export async function cargarCatalogoMedico() {
  const especialidades = await prisma.especialidad.findMany({
    where: { medicos: { some: { usuario: { activo: true, rol: "MEDICO" } } } },
    select: {
      id: true,
      nombre: true,
      medicos: {
        where: { usuario: { activo: true, rol: "MEDICO" } },
        select: {
          usuarioId: true,
          usuario: {
            select: { persona: { select: { nombreCompleto: true } } },
          },
        },
        orderBy: { usuario: { persona: { nombreCompleto: "asc" } } },
      },
    },
    orderBy: { nombre: "asc" },
  });
  return especialidades.map((esp) => ({
    id: esp.id.toString(),
    nombre: esp.nombre,
    medicos: esp.medicos.map((m) => ({
      id: m.usuarioId.toString(),
      nombre: m.usuario.persona.nombreCompleto,
    })),
  }));
}

export async function listarFechasAtencion(
  especialidadId: bigint,
  medicoId: bigint | null,
  fechaDesde: string,
) {
  const fechaHasta = sumarDias(fechaDesde, 60);
  const bloques = await prisma.disponibilidad.findMany({
    where: {
      fecha: { gte: fechaDb(fechaDesde), lte: fechaDb(fechaHasta) },
      estado: "PUBLICADA",
      ...(medicoId ? { profesionalId: medicoId } : {}),
      profesional: {
        activo: true,
        rol: "MEDICO",
        medico: { especialidadId },
      },
    },
    select: { fecha: true },
    orderBy: { fecha: "asc" },
  });
  return [
    ...new Set(bloques.map((b) => b.fecha.toISOString().slice(0, 10))),
  ].slice(0, 14);
}

export async function buscarHorariosDia(
  pacienteId: bigint,
  especialidadId: bigint,
  medicoId: bigint | null,
  fechaElegida: string,
  ahora = new Date(),
) {
  const [bloques, turnosPaciente] = await Promise.all([
    prisma.disponibilidad.findMany({
      where: {
        fecha: fechaDb(fechaElegida),
        estado: "PUBLICADA",
        ...(medicoId ? { profesionalId: medicoId } : {}),
        profesional: {
          activo: true,
          rol: "MEDICO",
          medico: { especialidadId },
        },
      },
      include: {
        profesional: {
          include: {
            persona: true,
            medico: { include: { especialidad: true } },
          },
        },
        turnos: {
          where: { estado: { in: ["RESERVADO", "CONFIRMADO"] } },
          select: {
            estado: true,
            retenidoHasta: true,
            hora: true,
            duracionMin: true,
          },
        },
      },
      orderBy: [{ fecha: "asc" }, { horaDesde: "asc" }],
    }),
    prisma.turno.findMany({
      where: {
        pacienteId,
        estado: { in: ["RESERVADO", "CONFIRMADO"] },
        disponibilidad: { fecha: { gte: fechaDb(hoySala(ahora)) } },
      },
      select: {
        estado: true,
        retenidoHasta: true,
        hora: true,
        duracionMin: true,
        tipo: true,
        disponibilidad: {
          select: {
            fecha: true,
            profesional: {
              select: { medico: { select: { especialidadId: true } } },
            },
          },
        },
      },
    }),
  ]);

  const vigentes = turnosPaciente.filter((t) =>
    ocupa(t.estado, t.retenidoHasta, ahora),
  );
  const citaMismaEspecialidad = vigentes.some(
    (t) =>
      t.tipo === "CONSULTA" &&
      `${t.disponibilidad.fecha.toISOString().slice(0, 10)}T${aHora(minutos(t.hora))}:00` >
        partesSala(ahora) &&
      t.disponibilidad.profesional.medico?.especialidadId === especialidadId,
  );
  const minimo = partesSala(new Date(ahora.getTime() + DIA_MS));
  const horarios: HorarioConsulta[] = [];
  const horariosAgregados = new Set<string>();
  const ocupadosPorMedico = new Map<
    bigint,
    { desde: number; hasta: number }[]
  >();
  for (const bloque of bloques) {
    const ocupados = ocupadosPorMedico.get(bloque.profesionalId) ?? [];
    for (const turno of bloque.turnos) {
      if (ocupa(turno.estado, turno.retenidoHasta, ahora)) {
        const desde = minutos(turno.hora);
        ocupados.push({ desde, hasta: desde + turno.duracionMin });
      }
    }
    ocupadosPorMedico.set(bloque.profesionalId, ocupados);
  }

  for (const bloque of bloques) {
    const medico = bloque.profesional.medico;
    if (!medico?.especialidad || medico.duracionTurnoMin <= 0) continue;
    const fecha = bloque.fecha.toISOString().slice(0, 10);
    const inicio = minutos(bloque.horaDesde);
    const fin = minutos(bloque.horaHasta);
    for (
      let minuto = inicio;
      minuto + medico.duracionTurnoMin <= fin;
      minuto += medico.duracionTurnoMin
    ) {
      const hora = aHora(minuto);
      if (`${fecha}T${hora}:00` < minimo) continue;
      const identidad = `${bloque.profesionalId}:${hora}`;
      if (horariosAgregados.has(identidad)) continue;
      const ocupado = (ocupadosPorMedico.get(bloque.profesionalId) ?? []).some(
        (turno) =>
          minuto < turno.hasta &&
          turno.desde < minuto + medico.duracionTurnoMin,
      );
      if (ocupado) continue;
      horariosAgregados.add(identidad);
      const superpuesto = vigentes.some((turno) => {
        if (turno.disponibilidad.fecha.toISOString().slice(0, 10) !== fecha)
          return false;
        const desde = minutos(turno.hora);
        return (
          minuto < desde + turno.duracionMin &&
          desde < minuto + medico.duracionTurnoMin
        );
      });
      horarios.push({
        clave: `${bloque.id}:${hora}`,
        disponibilidadId: bloque.id.toString(),
        medico: bloque.profesional.persona.nombreCompleto,
        especialidad: medico.especialidad.nombre,
        fecha,
        hora,
        duracionMin: medico.duracionTurnoMin,
        arancel: medico.arancelActual.toString(),
        superpuesto,
      });
    }
  }

  return {
    horarios: horarios.sort(
      (a, b) =>
        a.hora.localeCompare(b.hora) || a.medico.localeCompare(b.medico, "es"),
    ),
    citaMismaEspecialidad,
  };
}
