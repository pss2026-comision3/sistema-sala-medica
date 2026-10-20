"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/auth/guards";
import { AUDITORIA, MSG } from "@/lib/auth/constants";
import type { SesionActual } from "@/lib/auth/session";
import {
  MSG_PRESENCIAL,
  horariosLibresPresencial,
  validarHorarioPresencial,
} from "@/lib/agenda/presencial";
import {
  esFechaValida,
  etiquetaFecha,
  hoySala,
  inicioTurno,
} from "@/lib/agenda/reglas";
import { puedeCancelarPresencial } from "@/lib/agenda/reservas";
import { crearAvisoCancelacion } from "@/lib/notificaciones/avisos";
import { cargarCatalogoMedico } from "@/lib/turnos/buscar-horarios";
import {
  SELECCION_HABILITACION,
  buscarCitaVigenteEspecialidad,
  cargarOcupadosJornada,
  cargarOcupadosPaciente,
  habilitacionDe,
  liberarRetencionesVencidas,
} from "@/lib/turnos/presencial";

/*
 * US-SIG-015 — Gestionar solicitudes presenciales y reprogramaciones.
 *
 * CA1: Médico, Enfermería y Administración pueden reservar una cita médica
 *      para un registro Paciente existente y habilitado.
 * CA2: ese mismo personal puede reservar o cancelar hasta antes del inicio
 *      (sin la espera de 24 hs del autoservicio), respetando cupos, el
 *      límite de un turno por especialidad y las superposiciones. Queda
 *      registrada la solicitud y quién operó.
 *
 * La parte de "cita de vacunación" / "compromisos de vacunas" de CA1 y CA2
 * queda fuera: depende de la agenda del vacunatorio (US-SIG-022/023,
 * Sprint 3), que todavía no existe.
 */

const ROLES_PERMITIDOS: SesionActual["rol"][] = [
  "MEDICO",
  "ENFERMERIA",
  "ADMIN",
];

/** Error de negocio que se muestra tal cual al operador. */
class ErrorReservaPresencial extends Error {}

async function requireOperadorPresencial(): Promise<SesionActual> {
  const sesion = await requireSession();
  if (sesion.claveTemporal) redirect("/cambiar-clave");
  if (!ROLES_PERMITIDOS.includes(sesion.rol)) redirect("/sin-permiso");
  return sesion;
}

type Resultado<T> = { error: string } | ({ exito: true } & T);

function horaTexto(valor: Date): string {
  return valor.toISOString().slice(11, 16);
}
function fechaTexto(valor: Date): string {
  return valor.toISOString().slice(0, 10);
}
function aBigInt(valor: string): bigint | null {
  try {
    return BigInt(valor);
  } catch {
    return null;
  }
}

function revalidarPantallas() {
  revalidatePath("/turnos/presenciales");
  revalidatePath("/paciente/turnos");
  revalidatePath("/medico");
}

// ---------------------------------------------------------------------------
// CA1: elegir paciente y especialidad/médico
// ---------------------------------------------------------------------------

export type PacienteEncontrado = {
  id: string;
  nombre: string;
  dni: string;
  habilitado: boolean;
  motivoNoHabilitado: string | null;
};

/**
 * Búsqueda simple por nombre o DNI, para elegir el paciente a atender. Los
 * registros no habilitados (CA1) se devuelven marcados: se les pueden
 * cancelar citas, pero no reservar.
 */
export async function buscarPacientesPresencial(
  query: string,
): Promise<PacienteEncontrado[]> {
  await requireOperadorPresencial();
  const texto = query.trim();
  if (texto.length < 2) return [];

  const pacientes = await prisma.paciente.findMany({
    where: {
      OR: [
        { dni: { contains: texto } },
        {
          persona: { nombreCompleto: { contains: texto, mode: "insensitive" } },
        },
      ],
    },
    select: { personaId: true, dni: true, ...SELECCION_HABILITACION },
    orderBy: { persona: { nombreCompleto: "asc" } },
    take: 20,
  });

  const hoy = hoySala();
  return pacientes.map((p) => {
    const habilitacion = habilitacionDe(p, hoy);
    return {
      id: p.personaId.toString(),
      nombre: p.persona.nombreCompleto,
      dni: p.dni,
      habilitado: habilitacion.habilitado,
      motivoNoHabilitado: habilitacion.habilitado ? null : habilitacion.motivo,
    };
  });
}

/** Catálogo de especialidades y médicos activos, para elegir a quién reservarle. */
export async function listarCatalogoMedicoPresencial() {
  await requireOperadorPresencial();
  return cargarCatalogoMedico();
}

export type JornadaEncontrada = {
  disponibilidadId: string;
  horaDesde: string;
  horaHasta: string;
  duracionMin: number;
  /** Horarios libres para el médico y el paciente, ya filtrados (CA2). */
  horarios: string[];
};

/**
 * CA1/CA2: ubica la jornada publicada de un médico en una fecha (ya acordada
 * con el paciente) y devuelve los horarios que se le pueden reservar: de la
 * grilla de la jornada, futuros y sin superposición con el médico ni con el
 * paciente.
 */
export async function buscarJornadaPresencial(input: {
  pacienteId: string;
  medicoId: string;
  fecha: string;
}): Promise<Resultado<JornadaEncontrada>> {
  await requireOperadorPresencial();
  const pacienteId = aBigInt(input.pacienteId);
  const medicoId = aBigInt(input.medicoId);
  if (pacienteId === null) return { error: "Paciente no encontrado." };
  if (medicoId === null) return { error: "Médico no encontrado." };

  const ahora = new Date();
  if (!esFechaValida(input.fecha) || input.fecha < hoySala(ahora)) {
    return { error: MSG_PRESENCIAL.FECHA_PASADA };
  }

  const disponibilidad = await prisma.disponibilidad.findFirst({
    where: {
      profesionalId: medicoId,
      fecha: new Date(`${input.fecha}T00:00:00Z`),
      estado: "PUBLICADA",
    },
    select: {
      id: true,
      horaDesde: true,
      horaHasta: true,
      profesional: {
        select: { medico: { select: { duracionTurnoMin: true } } },
      },
    },
  });
  if (!disponibilidad) {
    return {
      error: "No hay una jornada publicada para ese médico en esa fecha.",
    };
  }
  const medico = disponibilidad.profesional.medico;
  if (!medico) {
    return { error: "Configuración del profesional no encontrada." };
  }

  const [ocupadosMedico, ocupadosPaciente] = await Promise.all([
    cargarOcupadosJornada(prisma, disponibilidad.id, ahora),
    cargarOcupadosPaciente(prisma, pacienteId, input.fecha, ahora),
  ]);
  const horaDesde = horaTexto(disponibilidad.horaDesde);
  const horaHasta = horaTexto(disponibilidad.horaHasta);

  return {
    exito: true,
    disponibilidadId: disponibilidad.id.toString(),
    horaDesde,
    horaHasta,
    duracionMin: medico.duracionTurnoMin,
    horarios: horariosLibresPresencial({
      fecha: input.fecha,
      horaDesde,
      horaHasta,
      duracionMin: medico.duracionTurnoMin,
      ahora,
      ocupadosMedico,
      ocupadosPaciente,
    }),
  };
}

// ---------------------------------------------------------------------------
// CA1/CA2: reservar (directo a CONFIRMADO, sin la retención de 5 min: la
// reserva presencial no necesita el "tiempo para decidir" del autoservicio)
// ---------------------------------------------------------------------------

export async function reservarCitaPresencial(input: {
  pacienteId: string;
  disponibilidadId: string;
  hora: string;
}): Promise<Resultado<{ mensaje: string }>> {
  const sesion = await requireOperadorPresencial();
  const operadorId = BigInt(sesion.usuarioId);

  const pacienteId = aBigInt(input.pacienteId);
  const disponibilidadId = aBigInt(input.disponibilidadId);
  if (pacienteId === null || disponibilidadId === null) {
    return { error: "Datos inválidos." };
  }

  const ahora = new Date();

  // CA1: solo registros Paciente existentes y habilitados.
  const paciente = await prisma.paciente.findUnique({
    where: { personaId: pacienteId },
    select: SELECCION_HABILITACION,
  });
  if (!paciente) return { error: "Paciente no encontrado." };
  const habilitacion = habilitacionDe(paciente, hoySala(ahora));
  if (!habilitacion.habilitado) {
    return { error: `No se puede reservar: ${habilitacion.motivo}` };
  }

  const disponibilidad = await prisma.disponibilidad.findUnique({
    where: { id: disponibilidadId },
    select: {
      id: true,
      estado: true,
      fecha: true,
      horaDesde: true,
      horaHasta: true,
      profesionalId: true,
      profesional: {
        select: {
          persona: { select: { nombreCompleto: true } },
          medico: {
            select: {
              especialidadId: true,
              especialidad: { select: { nombre: true } },
              duracionTurnoMin: true,
              arancelActual: true,
            },
          },
        },
      },
    },
  });
  if (!disponibilidad || disponibilidad.estado !== "PUBLICADA") {
    return { error: "El cupo seleccionado ya no está disponible." };
  }
  const medico = disponibilidad.profesional.medico;
  if (!medico) {
    return { error: "Configuración del profesional no encontrada." };
  }

  // CA2: límite de un turno vigente por especialidad para este paciente.
  if (medico.especialidadId) {
    const vigente = await buscarCitaVigenteEspecialidad(
      prisma,
      pacienteId,
      medico.especialidadId,
      ahora,
    );
    if (vigente) {
      return {
        error: vigente.pendienteResolucion
          ? MSG_PRESENCIAL.LIMITE_ESPECIALIDAD_PENDIENTE
          : MSG_PRESENCIAL.LIMITE_ESPECIALIDAD,
      };
    }
  }

  const fecha = fechaTexto(disponibilidad.fecha);
  const horaDate = new Date(`1970-01-01T${input.hora}:00Z`);

  try {
    const turno = await prisma.$transaction(async (tx) => {
      // Bloquea la jornada (mismo patrón que `reservarTurnoTemporal`): una
      // suspensión o reserva concurrente de esta jornada queda vista después.
      const filas = await tx.$queryRaw<{ estado: string }[]>`
        SELECT "estado"::text AS "estado"
        FROM "disponibilidad"
        WHERE "id" = ${disponibilidadId}
        FOR UPDATE`;
      if (filas[0]?.estado !== "PUBLICADA") {
        throw new ErrorReservaPresencial(
          "El cupo seleccionado ya no está disponible.",
        );
      }

      // CA2: cupo dentro de la grilla, futuro y sin superposición con el
      // médico ni con el paciente. Las retenciones vencidas no lo bloquean.
      await liberarRetencionesVencidas(tx, disponibilidadId, ahora);
      const ocupadosMedico = await cargarOcupadosJornada(
        tx,
        disponibilidadId,
        ahora,
      );
      const ocupadosPaciente = await cargarOcupadosPaciente(
        tx,
        pacienteId,
        fecha,
        ahora,
      );
      const regla = validarHorarioPresencial({
        fecha,
        hora: input.hora,
        horaDesde: horaTexto(disponibilidad.horaDesde),
        horaHasta: horaTexto(disponibilidad.horaHasta),
        duracionMin: medico.duracionTurnoMin,
        ahora,
        ocupadosMedico,
        ocupadosPaciente,
      });
      if ("error" in regla) throw new ErrorReservaPresencial(regla.error);

      const nuevo = await tx.turno.create({
        data: {
          pacienteId,
          disponibilidadId,
          creadoPor: operadorId,
          tipo: "CONSULTA",
          hora: horaDate,
          duracionMin: medico.duracionTurnoMin,
          arancel: medico.arancelActual,
          modalidad: "PARTICULAR",
          estado: "CONFIRMADO",
        },
      });

      await tx.auditoria.create({
        data: {
          actorId: operadorId,
          accion: AUDITORIA.RESERVA_PRESENCIAL,
          entidad: "turno",
          referenciaId: nuevo.id,
          detalle: JSON.stringify({
            pacienteId: pacienteId.toString(),
            operadorRol: sesion.rol,
            disponibilidadId: disponibilidadId.toString(),
            hora: input.hora,
          }),
        },
      });

      return nuevo;
    });

    revalidarPantallas();
    return {
      exito: true,
      mensaje: `Turno reservado para ${paciente.persona.nombreCompleto} el ${etiquetaFecha(fecha).toLowerCase()} a las ${input.hora} hs (turno #${turno.id}).`,
    };
  } catch (error) {
    if (error instanceof ErrorReservaPresencial)
      return { error: error.message };
    console.error("Error reservando cita presencial:", error);
    return { error: "Error interno al reservar el turno." };
  }
}

// ---------------------------------------------------------------------------
// CA2: cancelar hasta antes del inicio
// ---------------------------------------------------------------------------

export type CitaVigentePaciente = {
  id: string;
  fecha: string;
  fechaLegible: string;
  hora: string;
  profesional: string;
  especialidad: string;
  /** Jornada suspendida: la resuelve Administración (CA3), no se cancela acá. */
  pendienteResolucion: boolean;
};

/** Próximas citas confirmadas del paciente, para elegir cuál cancelar. */
export async function listarCitasVigentesPaciente(
  pacienteId: string,
): Promise<CitaVigentePaciente[]> {
  await requireOperadorPresencial();
  const id = aBigInt(pacienteId);
  if (id === null) return [];

  const ahora = new Date();
  const filas = await prisma.turno.findMany({
    where: {
      pacienteId: id,
      estado: "CONFIRMADO",
      resultado: "SIN_REGISTRAR",
      tipo: "CONSULTA",
      disponibilidad: {
        fecha: { gte: new Date(`${fechaTexto(ahora)}T00:00:00Z`) },
      },
    },
    select: {
      id: true,
      hora: true,
      disponibilidad: {
        select: {
          fecha: true,
          estado: true,
          profesional: {
            select: {
              persona: { select: { nombreCompleto: true } },
              medico: {
                select: { especialidad: { select: { nombre: true } } },
              },
            },
          },
        },
      },
    },
    orderBy: [{ disponibilidad: { fecha: "asc" } }, { hora: "asc" }],
    take: 50,
  });

  return filas.map((t) => {
    const fecha = fechaTexto(t.disponibilidad.fecha);
    return {
      id: t.id.toString(),
      fecha,
      fechaLegible: etiquetaFecha(fecha),
      hora: horaTexto(t.hora),
      profesional: t.disponibilidad.profesional.persona.nombreCompleto,
      especialidad:
        t.disponibilidad.profesional.medico?.especialidad?.nombre ??
        "Consulta médica",
      pendienteResolucion: t.disponibilidad.estado === "SUSPENDIDA",
    };
  });
}

export async function cancelarCitaPresencial(input: {
  turnoId: string;
}): Promise<Resultado<{ mensaje: string }>> {
  const sesion = await requireOperadorPresencial();
  const operadorId = BigInt(sesion.usuarioId);

  const turnoId = aBigInt(input.turnoId);
  if (turnoId === null) return { error: MSG.CANCELACION_NO_ENCONTRADO };

  const turno = await prisma.turno.findUnique({
    where: { id: turnoId },
    select: {
      id: true,
      estado: true,
      resultado: true,
      hora: true,
      pacienteId: true,
      disponibilidad: {
        select: {
          fecha: true,
          estado: true,
          profesional: {
            select: {
              persona: { select: { nombreCompleto: true } },
              medico: {
                select: { especialidad: { select: { nombre: true } } },
              },
            },
          },
        },
      },
      paciente: {
        select: {
          persona: {
            select: {
              nombreCompleto: true,
              usuario: { select: { id: true, activo: true } },
            },
          },
          tutor: {
            select: {
              persona: {
                select: {
                  usuario: { select: { id: true, activo: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!turno) return { error: MSG.CANCELACION_NO_ENCONTRADO };

  // CA3: las citas de jornadas suspendidas las resuelve Administración.
  if (turno.disponibilidad.estado === "SUSPENDIDA") {
    return { error: MSG_PRESENCIAL.CITA_SUSPENDIDA };
  }

  const fecha = fechaTexto(turno.disponibilidad.fecha);
  const hora = horaTexto(turno.hora);
  const inicio = inicioTurno(fecha, hora);
  const ahora = new Date();

  const regla = puedeCancelarPresencial(
    { estado: turno.estado, inicio, resultado: turno.resultado },
    ahora,
  );
  if (!regla.puede) return { error: regla.motivo };

  const beneficiario = turno.paciente.persona.nombreCompleto;
  const profesional = turno.disponibilidad.profesional.persona.nombreCompleto;
  const prestacion =
    turno.disponibilidad.profesional.medico?.especialidad?.nombre ??
    "Consulta médica";
  const fechaLegible = etiquetaFecha(fecha);
  const destino = turno.paciente.persona.usuario?.activo
    ? turno.paciente.persona.usuario
    : turno.paciente.tutor?.persona.usuario?.activo
      ? turno.paciente.tutor.persona.usuario
      : null;

  try {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.turno.updateMany({
        where: {
          id: turnoId,
          estado: "CONFIRMADO",
          resultado: "SIN_REGISTRAR",
          disponibilidad: { estado: "PUBLICADA" },
        },
        data: {
          estado: "CANCELADO",
          canceladoEn: ahora,
          canceladoPor: operadorId,
          motivoCancelacion: `Cancelación presencial (operador: ${sesion.rol}).`,
          origenCancelacion: "presencial",
        },
      });
      if (count === 0) throw new Error(MSG.CANCELACION_ESTADO);

      // Aviso interno al paciente o a su tutor (US-031: sin emails externos).
      if (destino) {
        await crearAvisoCancelacion(tx, {
          turnoId,
          usuarioId: destino.id,
          resumen: [
            `Se canceló presencialmente el turno de ${beneficiario}.`,
            `Prestación: ${prestacion}.`,
            `Fecha: ${fecha} a las ${hora} hs.`,
            `Profesional: ${profesional}.`,
          ].join(" "),
        });
      }

      await tx.auditoria.create({
        data: {
          actorId: operadorId,
          accion: AUDITORIA.CANCELACION_PRESENCIAL,
          entidad: "turno",
          referenciaId: turnoId,
          detalle: JSON.stringify({
            pacienteId: turno.pacienteId.toString(),
            operadorRol: sesion.rol,
            sinDestinatario: destino === null,
          }),
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === MSG.CANCELACION_ESTADO) {
      return { error: error.message };
    }
    console.error("Error cancelando cita presencial:", error);
    return { error: "Error interno al cancelar el turno." };
  }

  revalidarPantallas();
  return {
    exito: true,
    mensaje: `Cita de ${beneficiario} del ${fechaLegible.toLowerCase()} a las ${hora} hs cancelada.`,
  };
}
