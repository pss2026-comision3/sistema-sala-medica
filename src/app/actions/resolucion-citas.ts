"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/auth/guards";
import { AUDITORIA } from "@/lib/auth/constants";
import {
  MSG_PRESENCIAL,
  horariosLibresPresencial,
  validarHorarioPresencial,
} from "@/lib/agenda/presencial";
import { esFechaValida, etiquetaFecha, hoySala } from "@/lib/agenda/reglas";
import {
  MSG_RESOLUCION,
  ORIGEN_CANCELACION_REPROGRAMACION,
  ORIGEN_CANCELACION_RESOLUCION,
  cuerpoAvisoCancelacionResolucion,
  cuerpoAvisoReprogramacion,
  puedeResolverCita,
  validarMotivoResolucion,
} from "@/lib/agenda/resolucion";
import {
  crearAvisoCancelacion,
  crearAvisoReprogramacion,
} from "@/lib/notificaciones/avisos";
import { notificarPorEmail } from "@/lib/notificaciones/email-turno";
import { cargarCatalogoMedico } from "@/lib/turnos/buscar-horarios";
import {
  buscarCitaVigenteEspecialidad,
  cargarOcupadosJornada,
  cargarOcupadosPaciente,
  liberarRetencionesVencidas,
} from "@/lib/turnos/presencial";

/*
 * US-SIG-015 — Gestionar solicitudes presenciales y reprogramaciones.
 *
 * CA3: Administración resuelve individualmente las citas médicas confirmadas
 *      de jornadas suspendidas: las cancela con motivo o registra un nuevo
 *      horario de la misma especialidad (acordado con el paciente fuera del
 *      sistema, por eso no se ofrece un buscador: se carga directamente).
 * CA4: reprogramar confirma el nuevo cupo y cancela el anterior como una
 *      operación conjunta, en una única transacción; si el nuevo horario no
 *      puede obtenerse, no se toca el original.
 * CA6: una cita puede resolverse después de su horario si no tiene atención
 *      registrada. No se tocan consultas ya realizadas (eso lo garantiza
 *      `puedeResolverCita`, que exige `resultado = SIN_REGISTRAR`).
 */

/** Error de negocio que se muestra tal cual al operador. */
class ErrorResolucion extends Error {}

async function requireAdmin() {
  const sesion = await requireSession();
  if (sesion.claveTemporal) redirect("/cambiar-clave");
  if (sesion.rol !== "ADMIN") redirect("/sin-permiso");
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
  revalidatePath("/admin/jornadas");
  revalidatePath("/medico");
  revalidatePath("/paciente/turnos");
}

// ---------------------------------------------------------------------------
// CA3: listado de citas pendientes de resolución
// ---------------------------------------------------------------------------

export type CitaPendienteResolucion = {
  id: string;
  disponibilidadId: string;
  fecha: string;
  fechaLegible: string;
  hora: string;
  paciente: string;
  dni: string;
  profesional: string;
  especialidad: string;
  motivoSuspension: string | null;
};

const SELECCION_CITA = {
  id: true,
  disponibilidadId: true,
  hora: true,
  estado: true,
  resultado: true,
  pacienteId: true,
  paciente: {
    select: {
      dni: true,
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
  disponibilidad: {
    select: {
      estado: true,
      fecha: true,
      motivoSuspension: true,
      profesional: {
        select: {
          id: true,
          persona: { select: { nombreCompleto: true } },
          medico: {
            select: {
              especialidadId: true,
              especialidad: { select: { nombre: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.TurnoSelect;

type CitaCargada = Prisma.TurnoGetPayload<{ select: typeof SELECCION_CITA }>;

/** Destinatario del aviso: la cuenta del paciente adulto o, si es un menor, la de su tutor. */
function destinatarioDe(turno: CitaCargada) {
  const propio = turno.paciente.persona.usuario;
  if (propio?.activo) return propio;
  const tutor = turno.paciente.tutor?.persona.usuario;
  if (tutor?.activo) return tutor;
  return null;
}

/** CA3: citas confirmadas de jornadas suspendidas, listas para resolver. */
export async function listarCitasPendientesDeResolver(): Promise<
  CitaPendienteResolucion[]
> {
  await requireAdmin();

  const filas = await prisma.turno.findMany({
    where: {
      estado: "CONFIRMADO",
      resultado: "SIN_REGISTRAR",
      disponibilidad: { estado: "SUSPENDIDA" },
    },
    select: SELECCION_CITA,
    orderBy: [{ disponibilidad: { fecha: "asc" } }, { hora: "asc" }],
    take: 200,
  });

  return filas.map((t) => {
    const fecha = fechaTexto(t.disponibilidad.fecha);
    return {
      id: t.id.toString(),
      disponibilidadId: t.disponibilidadId.toString(),
      fecha,
      fechaLegible: etiquetaFecha(fecha),
      hora: horaTexto(t.hora),
      paciente: t.paciente.persona.nombreCompleto,
      dni: t.paciente.dni,
      profesional: t.disponibilidad.profesional.persona.nombreCompleto,
      especialidad:
        t.disponibilidad.profesional.medico?.especialidad?.nombre ??
        "Consulta médica",
      motivoSuspension: t.disponibilidad.motivoSuspension,
    };
  });
}

async function cargarCitaResoluble(
  turnoId: bigint,
): Promise<{ cita: CitaCargada } | { error: string }> {
  const cita = await prisma.turno.findUnique({
    where: { id: turnoId },
    select: SELECCION_CITA,
  });
  if (!cita) return { error: MSG_RESOLUCION.CITA_NO_ENCONTRADA };
  const regla = puedeResolverCita(cita, cita.disponibilidad);
  if (!regla.puede) return { error: regla.motivo };
  return { cita };
}

// ---------------------------------------------------------------------------
// CA3: cancelar con motivo
// ---------------------------------------------------------------------------

export async function cancelarCitaAfectada(input: {
  turnoId: string;
  motivo: string;
}): Promise<Resultado<{ mensaje: string }>> {
  const sesion = await requireAdmin();
  const adminId = BigInt(sesion.usuarioId);

  const motivo = validarMotivoResolucion(input.motivo);
  if ("error" in motivo) return { error: motivo.error };

  const turnoId = aBigInt(input.turnoId);
  if (turnoId === null) return { error: MSG_RESOLUCION.CITA_NO_ENCONTRADA };

  const cargada = await cargarCitaResoluble(turnoId);
  if ("error" in cargada) return { error: cargada.error };
  const { cita } = cargada;

  const ahora = new Date();
  const fecha = fechaTexto(cita.disponibilidad.fecha);
  const fechaLegible = etiquetaFecha(fecha);
  const hora = horaTexto(cita.hora);
  const beneficiario = cita.paciente.persona.nombreCompleto;
  const prestacion =
    cita.disponibilidad.profesional.medico?.especialidad?.nombre ??
    "Consulta médica";
  const destino = destinatarioDe(cita);

  try {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.turno.updateMany({
        where: {
          id: turnoId,
          estado: "CONFIRMADO",
          resultado: "SIN_REGISTRAR",
        },
        data: {
          estado: "CANCELADO",
          canceladoEn: ahora,
          canceladoPor: adminId,
          motivoCancelacion: motivo.motivo,
          origenCancelacion: ORIGEN_CANCELACION_RESOLUCION,
        },
      });
      if (count === 0) {
        throw new ErrorResolucion(MSG_RESOLUCION.CITA_YA_RESUELTA);
      }

      // Aviso interno al paciente o a su tutor (US-031).
      if (destino) {
        await crearAvisoCancelacion(tx, {
          turnoId,
          usuarioId: destino.id,
          resumen: cuerpoAvisoCancelacionResolucion({
            beneficiario,
            prestacion,
            fechaLegible,
            hora,
            motivo: motivo.motivo,
          }),
        });
      }

      await tx.auditoria.create({
        data: {
          actorId: adminId,
          accion: AUDITORIA.RESOLUCION_CANCELACION_SUSPENSION,
          entidad: "turno",
          referenciaId: turnoId,
          detalle: JSON.stringify({
            motivo: motivo.motivo,
            pacienteId: cita.pacienteId.toString(),
            sinDestinatario: destino === null,
          }),
        },
      });
    });
  } catch (error) {
    if (error instanceof ErrorResolucion) return { error: error.message };
    console.error("Error cancelando cita afectada:", error);
    return { error: MSG_RESOLUCION.ERROR_INTERNO };
  }

  // Email de cancelación (US-031): después de la transacción, sin esperar.
  notificarPorEmail("CANCELACION", turnoId);

  revalidarPantallas();
  return {
    exito: true,
    mensaje: `Cita del ${fechaLegible.toLowerCase()} a las ${hora} hs cancelada.`,
  };
}

// ---------------------------------------------------------------------------
// CA4: reprogramar (confirma el nuevo cupo y cancela el anterior, atómico)
// ---------------------------------------------------------------------------

export type ContextoReprogramacion = {
  especialidad: string;
  medicoActualId: string;
  medicos: { id: string; nombre: string }[];
};

export type DisponibilidadEncontrada = {
  disponibilidadId: string;
  horaDesde: string;
  horaHasta: string;
  duracionMin: number;
  /** Horarios libres para el médico y el paciente, ya filtrados (CA4). */
  horarios: string[];
};

/**
 * CA3/CA4: ubica la jornada publicada de un médico de la misma especialidad
 * en una fecha (lo que ya se acordó con el paciente) y devuelve los horarios
 * a los que se puede reprogramar: de la grilla, futuros y sin superposición
 * con el médico ni con otros turnos del paciente (la cita original no cuenta).
 */
export async function buscarDisponibilidadParaReprogramar(input: {
  turnoId: string;
  medicoId: string;
  fecha: string;
}): Promise<Resultado<DisponibilidadEncontrada>> {
  await requireAdmin();
  const turnoId = aBigInt(input.turnoId);
  const medicoId = aBigInt(input.medicoId);
  if (turnoId === null) return { error: MSG_RESOLUCION.CITA_NO_ENCONTRADA };
  if (medicoId === null)
    return { error: MSG_RESOLUCION.JORNADA_DESTINO_NO_PUBLICADA };

  const ahora = new Date();
  if (!esFechaValida(input.fecha) || input.fecha < hoySala(ahora)) {
    return { error: MSG_PRESENCIAL.FECHA_PASADA };
  }

  const cargada = await cargarCitaResoluble(turnoId);
  if ("error" in cargada) return { error: cargada.error };
  const { cita } = cargada;
  const especialidadOriginal =
    cita.disponibilidad.profesional.medico?.especialidadId;
  if (!especialidadOriginal) {
    return { error: MSG_RESOLUCION.MEDICO_SIN_ESPECIALIDAD };
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
        select: {
          medico: {
            select: { especialidadId: true, duracionTurnoMin: true },
          },
        },
      },
    },
  });
  if (!disponibilidad) {
    return { error: MSG_RESOLUCION.JORNADA_DESTINO_NO_PUBLICADA };
  }
  const medico = disponibilidad.profesional.medico;
  if (
    !medico ||
    medico.especialidadId?.toString() !== especialidadOriginal.toString()
  ) {
    return { error: MSG_RESOLUCION.ESPECIALIDAD_DISTINTA };
  }

  const [ocupadosMedico, ocupadosPaciente] = await Promise.all([
    cargarOcupadosJornada(prisma, disponibilidad.id, ahora),
    cargarOcupadosPaciente(
      prisma,
      cita.pacienteId,
      input.fecha,
      ahora,
      turnoId,
    ),
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

/** Médicos de la misma especialidad que la cita original, para elegir a quién reprogramar. */
export async function obtenerContextoReprogramacion(
  turnoId: string,
): Promise<Resultado<ContextoReprogramacion>> {
  await requireAdmin();
  const id = aBigInt(turnoId);
  if (id === null) return { error: MSG_RESOLUCION.CITA_NO_ENCONTRADA };

  const cargada = await cargarCitaResoluble(id);
  if ("error" in cargada) return { error: cargada.error };
  const { cita } = cargada;

  const especialidadId = cita.disponibilidad.profesional.medico?.especialidadId;
  if (!especialidadId) {
    return { error: MSG_RESOLUCION.MEDICO_SIN_ESPECIALIDAD };
  }

  const catalogo = await cargarCatalogoMedico();
  const especialidad = catalogo.find((e) => e.id === especialidadId.toString());

  return {
    exito: true,
    especialidad: especialidad?.nombre ?? "Consulta médica",
    medicoActualId: cita.disponibilidad.profesional.id.toString(),
    medicos: especialidad?.medicos ?? [],
  };
}

/**
 * CA4: crea el nuevo turno confirmado y cancela el original en una sola
 * transacción. Si el nuevo horario no se puede obtener, no se modifica nada.
 */
export async function reprogramarCitaAfectada(input: {
  turnoId: string;
  nuevaDisponibilidadId: string;
  nuevaHora: string;
}): Promise<Resultado<{ mensaje: string }>> {
  const sesion = await requireAdmin();
  const adminId = BigInt(sesion.usuarioId);

  const turnoId = aBigInt(input.turnoId);
  const nuevaDisponibilidadId = aBigInt(input.nuevaDisponibilidadId);
  if (turnoId === null || nuevaDisponibilidadId === null) {
    return { error: MSG_RESOLUCION.CITA_NO_ENCONTRADA };
  }

  const cargada = await cargarCitaResoluble(turnoId);
  if ("error" in cargada) return { error: cargada.error };
  const { cita } = cargada;

  const especialidadOriginal =
    cita.disponibilidad.profesional.medico?.especialidadId;
  if (!especialidadOriginal) {
    return { error: MSG_RESOLUCION.MEDICO_SIN_ESPECIALIDAD };
  }

  const nuevaDisponibilidad = await prisma.disponibilidad.findUnique({
    where: { id: nuevaDisponibilidadId },
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
              duracionTurnoMin: true,
              arancelActual: true,
            },
          },
        },
      },
    },
  });
  if (!nuevaDisponibilidad) {
    return { error: MSG_RESOLUCION.JORNADA_DESTINO_NO_PUBLICADA };
  }
  if (nuevaDisponibilidad.estado !== "PUBLICADA") {
    return { error: MSG_RESOLUCION.JORNADA_DESTINO_NO_PUBLICADA };
  }
  const medicoDestino = nuevaDisponibilidad.profesional.medico;
  if (
    !medicoDestino ||
    medicoDestino.especialidadId?.toString() !== especialidadOriginal.toString()
  ) {
    return { error: MSG_RESOLUCION.ESPECIALIDAD_DISTINTA };
  }

  const ahora = new Date();

  // CA4: el turno reemplazado se excluye del límite de la especialidad, pero
  // cualquier otro turno vigente de esa especialidad sigue contando.
  const otraVigente = await buscarCitaVigenteEspecialidad(
    prisma,
    cita.pacienteId,
    especialidadOriginal,
    ahora,
    turnoId,
  );
  if (otraVigente) {
    return { error: MSG_PRESENCIAL.LIMITE_ESPECIALIDAD_REPROGRAMACION };
  }

  const fechaOriginal = fechaTexto(cita.disponibilidad.fecha);
  const fechaOriginalLegible = etiquetaFecha(fechaOriginal);
  const horaOriginal = horaTexto(cita.hora);
  const fechaNueva = fechaTexto(nuevaDisponibilidad.fecha);
  const fechaNuevaLegible = etiquetaFecha(fechaNueva);
  const beneficiario = cita.paciente.persona.nombreCompleto;
  const prestacion =
    cita.disponibilidad.profesional.medico?.especialidad?.nombre ??
    "Consulta médica";
  const nuevoProfesional =
    nuevaDisponibilidad.profesional.persona.nombreCompleto;
  const destino = destinatarioDe(cita);
  const horaNuevaDate = new Date(`1970-01-01T${input.nuevaHora}:00Z`);

  let nuevoTurnoId: bigint;
  try {
    nuevoTurnoId = await prisma.$transaction(async (tx) => {
      // Bloquea la jornada destino (mismo patrón que `reservarTurnoTemporal` /
      // `suspenderJornada`): una suspensión concurrente de esa jornada espera
      // a este lock y queda vista después, nunca se confirma sobre ella.
      const filas = await tx.$queryRaw<{ estado: string }[]>`
        SELECT "estado"::text AS "estado"
        FROM "disponibilidad"
        WHERE "id" = ${nuevaDisponibilidadId}
        FOR UPDATE`;
      if (filas[0]?.estado !== "PUBLICADA") {
        throw new ErrorResolucion(MSG_RESOLUCION.JORNADA_DESTINO_NO_PUBLICADA);
      }

      // CA4: el nuevo horario tiene que ser de la grilla, futuro y sin
      // superposición con el médico ni con otros turnos del paciente (la
      // cita original no cuenta). Las retenciones vencidas no lo bloquean.
      await liberarRetencionesVencidas(tx, nuevaDisponibilidadId, ahora);
      const ocupadosMedico = await cargarOcupadosJornada(
        tx,
        nuevaDisponibilidadId,
        ahora,
      );
      const ocupadosPaciente = await cargarOcupadosPaciente(
        tx,
        cita.pacienteId,
        fechaNueva,
        ahora,
        turnoId,
      );
      const regla = validarHorarioPresencial({
        fecha: fechaNueva,
        hora: input.nuevaHora,
        horaDesde: horaTexto(nuevaDisponibilidad.horaDesde),
        horaHasta: horaTexto(nuevaDisponibilidad.horaHasta),
        duracionMin: medicoDestino.duracionTurnoMin,
        ahora,
        ocupadosMedico,
        ocupadosPaciente,
      });
      if ("error" in regla) throw new ErrorResolucion(regla.error);

      // Cancela el original. Si mientras tanto alguien más ya lo resolvió,
      // se aborta toda la transacción y no se crea el turno nuevo.
      const { count } = await tx.turno.updateMany({
        where: {
          id: turnoId,
          estado: "CONFIRMADO",
          resultado: "SIN_REGISTRAR",
        },
        data: {
          estado: "CANCELADO",
          canceladoEn: ahora,
          canceladoPor: adminId,
          motivoCancelacion: `Reprogramado a ${fechaNuevaLegible} ${input.nuevaHora} hs.`,
          origenCancelacion: ORIGEN_CANCELACION_REPROGRAMACION,
        },
      });
      if (count === 0) {
        throw new ErrorResolucion(MSG_RESOLUCION.CITA_YA_RESUELTA);
      }

      const nuevoTurno = await tx.turno.create({
        data: {
          pacienteId: cita.pacienteId,
          disponibilidadId: nuevaDisponibilidadId,
          creadoPor: adminId,
          tipo: "CONSULTA",
          hora: horaNuevaDate,
          duracionMin: medicoDestino.duracionTurnoMin,
          arancel: medicoDestino.arancelActual,
          modalidad: "PARTICULAR",
          estado: "CONFIRMADO",
          reprogramadoDesdeId: turnoId,
        },
      });

      // Aviso interno sobre el turno nuevo, para que apunte a la cita vigente.
      if (destino) {
        await crearAvisoReprogramacion(tx, {
          turnoId: nuevoTurno.id,
          usuarioId: destino.id,
          resumen: cuerpoAvisoReprogramacion({
            beneficiario,
            prestacion,
            fechaLegible: fechaOriginalLegible,
            hora: horaOriginal,
            nuevaFechaLegible: fechaNuevaLegible,
            nuevaHora: input.nuevaHora,
            nuevoProfesional,
          }),
        });
      }

      await tx.auditoria.create({
        data: {
          actorId: adminId,
          accion: AUDITORIA.RESOLUCION_REPROGRAMACION_SUSPENSION,
          entidad: "turno",
          referenciaId: turnoId,
          detalle: JSON.stringify({
            pacienteId: cita.pacienteId.toString(),
            nuevoTurnoId: nuevoTurno.id.toString(),
            nuevaDisponibilidadId: nuevaDisponibilidadId.toString(),
            nuevaHora: input.nuevaHora,
            sinDestinatario: destino === null,
          }),
        },
      });

      return nuevoTurno.id;
    });
  } catch (error) {
    if (error instanceof ErrorResolucion) return { error: error.message };
    console.error("Error reprogramando cita afectada:", error);
    return { error: MSG_RESOLUCION.ERROR_INTERNO };
  }

  // Emails (US-031): la reprogramación se avisa como cancelación del turno
  // anterior + confirmación del nuevo, cada uno con su fecha.
  notificarPorEmail("CANCELACION", turnoId);
  notificarPorEmail("CONFIRMACION", nuevoTurnoId);

  revalidarPantallas();
  return {
    exito: true,
    mensaje: `Cita reprogramada a ${fechaNuevaLegible.toLowerCase()} ${input.nuevaHora} hs.`,
  };
}
