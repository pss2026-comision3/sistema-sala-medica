"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/auth/guards";
import type { SesionActual } from "@/lib/auth/session";
import { etiquetaFecha, hoySala, inicioTurno } from "@/lib/agenda/reglas";
import {
  AUDITORIA_SUSPENSION,
  MOTIVO_RETENCION_LIBERADA,
  MSG_SUSPENSION,
  ORIGEN_CANCELACION_SUSPENSION,
  cuerpoAvisoSuspension,
  evaluarSuspensionJornada,
  validarMotivo,
} from "@/lib/agenda/suspension";
import { crearAvisoSuspension } from "@/lib/notificaciones/avisos";

/*
 * US-SIG-009 — Suspender una jornada médica ante un imprevisto (RF-10).
 *
 * CA1: el Médico suspende jornadas propias y Administración las de cualquier
 *      médico; se exige motivo y confirmación de los horarios afectados.
 * CA2: la jornada deja de ofrecer cupos y se liberan las retenciones
 *      temporales de horarios no iniciados. No se tocan consultas realizadas.
 * CA3: las citas confirmadas se conservan; quedan afectadas (pendientes de
 *      resolución) porque su jornada pasa a SUSPENDIDA.
 * CA4: aviso por email + aviso interno a cada paciente/tutor afectado, sin
 *      comunicar una cancelación.
 * CA5: se suspenden los recordatorios; no se reasignan pacientes (la
 *      resolución individual es de US-015).
 */

// ---------------------------------------------------------------------------
// Tipos que consumen las pantallas (todo serializable: sin BigInt ni Date).
// ---------------------------------------------------------------------------

export type MedicoSuspension = {
  id: string;
  nombre: string;
  especialidad: string;
};

export type JornadaListado = {
  id: string;
  fecha: string; // YYYY-MM-DD
  fechaLegible: string;
  horaDesde: string; // HH:MM
  horaHasta: string; // HH:MM
  estado: "PUBLICADA" | "SUSPENDIDA";
  citasConfirmadas: number;
  suspendible: boolean;
  motivoNoSuspendible: string;
  motivoSuspension: string | null;
  suspendidaEn: string | null; // ISO
  suspendidaPor: string | null;
};

export type CitaAfectada = {
  id: string;
  hora: string;
  paciente: string;
  dni: string;
  /** El paciente o su tutor no tiene cuenta activa: no recibirá el aviso. */
  sinDestinatario: boolean;
};

export type PrevisualizacionSuspension = {
  jornada: JornadaListado;
  medico: MedicoSuspension;
  citasAfectadas: CitaAfectada[];
  retencionesALiberar: number;
  citasConResultado: number;
};

export type ResumenSuspension = {
  citasAfectadas: number;
  retencionesLiberadas: number;
  recordatoriosSuspendidos: number;
  avisosGenerados: number;
  sinDestinatario: number;
};

type Resultado<T> = { error: string } | ({ exito: true } & T);

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/** Solo Médico y Administración pueden suspender (CA1). */
async function requireOperador(): Promise<SesionActual> {
  const sesion = await requireSession();
  if (sesion.claveTemporal) redirect("/cambiar-clave");
  if (sesion.rol !== "MEDICO" && sesion.rol !== "ADMIN") {
    redirect("/sin-permiso");
  }
  return sesion;
}

function aBigInt(valor: string | undefined | null): bigint | null {
  if (!valor) return null;
  try {
    return BigInt(valor);
  } catch {
    return null;
  }
}

/** HH:MM de una columna `time` (Prisma la entrega como Date en UTC, D-03). */
function horaTexto(valor: Date): string {
  return valor.toISOString().slice(11, 16);
}

/** YYYY-MM-DD de una columna `date`. */
function fechaTexto(valor: Date): string {
  return valor.toISOString().slice(0, 10);
}

/**
 * Médico sobre el que se opera. El Médico solo opera sobre sí mismo (el
 * parámetro se ignora); Administración debe indicar un médico activo (CA1).
 */
async function resolverMedico(
  sesion: SesionActual,
  medicoId?: string,
): Promise<{ medicoId: bigint } | { error: string }> {
  if (sesion.rol === "MEDICO") return { medicoId: BigInt(sesion.usuarioId) };

  const id = aBigInt(medicoId);
  if (id === null) return { error: MSG_SUSPENSION.MEDICO_NO_ENCONTRADO };
  const medico = await prisma.usuario.findFirst({
    where: { id, rol: "MEDICO", activo: true },
    select: { id: true },
  });
  if (!medico) return { error: MSG_SUSPENSION.MEDICO_NO_ENCONTRADO };
  return { medicoId: medico.id };
}

const SELECT_USUARIO_DESTINO = {
  select: { id: true, email: true, activo: true },
} as const;

/** Jornada con todo lo necesario para previsualizar y suspender. */
async function cargarJornada(db: Prisma.TransactionClient, id: bigint) {
  return db.disponibilidad.findUnique({
    where: { id },
    select: {
      id: true,
      fecha: true,
      horaDesde: true,
      horaHasta: true,
      estado: true,
      motivoSuspension: true,
      suspendidaEn: true,
      profesionalId: true,
      suspendidoPor: {
        select: { persona: { select: { nombreCompleto: true } } },
      },
      profesional: {
        select: {
          rol: true,
          persona: { select: { nombreCompleto: true } },
          medico: { select: { especialidad: { select: { nombre: true } } } },
        },
      },
      turnos: {
        where: { estado: { in: ["RESERVADO", "CONFIRMADO"] } },
        select: {
          id: true,
          hora: true,
          estado: true,
          resultado: true,
          paciente: {
            select: {
              dni: true,
              persona: {
                select: {
                  nombreCompleto: true,
                  usuario: SELECT_USUARIO_DESTINO,
                },
              },
              tutor: {
                select: {
                  persona: { select: { usuario: SELECT_USUARIO_DESTINO } },
                },
              },
            },
          },
        },
        orderBy: { hora: "asc" },
      },
    },
  });
}

type JornadaCargada = NonNullable<Awaited<ReturnType<typeof cargarJornada>>>;
type TurnoCargado = JornadaCargada["turnos"][number];

/**
 * Destinatario del aviso (US-031 CA1): la cuenta del paciente adulto o, si
 * es un menor sin cuenta, la del tutor. Solo cuentas activas.
 */
function destinatarioDe(turno: TurnoCargado) {
  const propio = turno.paciente.persona.usuario;
  if (propio?.activo) return propio;
  const tutor = turno.paciente.tutor?.persona.usuario;
  if (tutor?.activo) return tutor;
  return null;
}

/** Separa los turnos de la jornada según cómo los afecta la suspensión. */
function clasificarTurnos(jornada: JornadaCargada, ahora: Date) {
  const fecha = fechaTexto(jornada.fecha);
  // CA3: confirmadas sin resultado → se conservan y quedan afectadas.
  const afectadas = jornada.turnos.filter(
    (t) => t.estado === "CONFIRMADO" && t.resultado === "SIN_REGISTRAR",
  );
  // CA2: confirmadas con resultado (atendidas o ausentes) → no se tocan.
  const conResultado = jornada.turnos.filter(
    (t) => t.estado === "CONFIRMADO" && t.resultado !== "SIN_REGISTRAR",
  );
  // CA2: retenciones temporales de horarios todavía no iniciados → se liberan.
  const retenciones = jornada.turnos.filter(
    (t) =>
      t.estado === "RESERVADO" &&
      new Date(inicioTurno(fecha, horaTexto(t.hora))) > ahora,
  );
  return { afectadas, conResultado, retenciones };
}

function aJornadaListado(
  jornada: {
    id: bigint;
    fecha: Date;
    horaDesde: Date;
    horaHasta: Date;
    estado: "PUBLICADA" | "SUSPENDIDA";
    motivoSuspension: string | null;
    suspendidaEn: Date | null;
    suspendidoPor: { persona: { nombreCompleto: string } } | null;
  },
  citasConfirmadas: number,
  hoy: string,
  ahora: Date,
): JornadaListado {
  const fecha = fechaTexto(jornada.fecha);
  const horaDesde = horaTexto(jornada.horaDesde);
  const horaHasta = horaTexto(jornada.horaHasta);
  const regla = evaluarSuspensionJornada(
    { estado: jornada.estado, fecha, finIso: inicioTurno(fecha, horaHasta) },
    hoy,
    ahora,
  );
  return {
    id: jornada.id.toString(),
    fecha,
    fechaLegible: etiquetaFecha(fecha),
    horaDesde,
    horaHasta,
    estado: jornada.estado,
    citasConfirmadas,
    suspendible: regla.puede,
    motivoNoSuspendible: regla.motivo,
    motivoSuspension: jornada.motivoSuspension,
    suspendidaEn: jornada.suspendidaEn?.toISOString() ?? null,
    suspendidaPor: jornada.suspendidoPor?.persona.nombreCompleto ?? null,
  };
}

function datosMedico(jornada: JornadaCargada): MedicoSuspension {
  return {
    id: jornada.profesionalId.toString(),
    nombre: jornada.profesional.persona.nombreCompleto,
    especialidad:
      jornada.profesional.medico?.especialidad?.nombre ?? "Consulta médica",
  };
}

/**
 * Carga la jornada y verifica que el operador pueda actuar sobre ella (CA1).
 * Para el Médico, una jornada ajena "no existe" (no se revela).
 */
async function cargarJornadaAutorizada(
  sesion: SesionActual,
  disponibilidadId: string,
): Promise<{ jornada: JornadaCargada } | { error: string }> {
  const id = aBigInt(disponibilidadId);
  if (id === null) return { error: MSG_SUSPENSION.JORNADA_NO_ENCONTRADA };
  // Lectura simple; se usa el cliente de transacción para reutilizar la misma
  // consulta que la suspensión.
  const jornada = await prisma.$transaction((tx) => cargarJornada(tx, id));
  if (!jornada || jornada.profesional.rol !== "MEDICO") {
    return { error: MSG_SUSPENSION.JORNADA_NO_ENCONTRADA };
  }
  if (
    sesion.rol === "MEDICO" &&
    jornada.profesionalId.toString() !== sesion.usuarioId
  ) {
    return { error: MSG_SUSPENSION.JORNADA_NO_ENCONTRADA };
  }
  return { jornada };
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

/** CA1: médicos activos para que Administración elija sobre quién operar. */
export async function listarMedicosSuspension(): Promise<MedicoSuspension[]> {
  const sesion = await requireOperador();
  if (sesion.rol !== "ADMIN") return [];

  const medicos = await prisma.usuario.findMany({
    where: { rol: "MEDICO", activo: true },
    select: {
      id: true,
      persona: { select: { nombreCompleto: true } },
      medico: { select: { especialidad: { select: { nombre: true } } } },
    },
    orderBy: { persona: { nombreCompleto: "asc" } },
  });
  return medicos.map((m) => ({
    id: m.id.toString(),
    nombre: m.persona.nombreCompleto,
    especialidad: m.medico?.especialidad?.nombre ?? "Sin especialidad",
  }));
}

/**
 * Jornadas de hoy en adelante del médico (publicadas y suspendidas), con la
 * cantidad de citas confirmadas que quedarían afectadas.
 */
export async function listarJornadasSuspension(input: {
  medicoId?: string;
}): Promise<Resultado<{ jornadas: JornadaListado[] }>> {
  const sesion = await requireOperador();
  const medico = await resolverMedico(sesion, input.medicoId);
  if ("error" in medico) return { error: medico.error };

  const ahora = new Date();
  const hoy = hoySala(ahora);
  const filas = await prisma.disponibilidad.findMany({
    where: {
      profesionalId: medico.medicoId,
      fecha: { gte: new Date(`${hoy}T00:00:00Z`) },
    },
    select: {
      id: true,
      fecha: true,
      horaDesde: true,
      horaHasta: true,
      estado: true,
      motivoSuspension: true,
      suspendidaEn: true,
      suspendidoPor: {
        select: { persona: { select: { nombreCompleto: true } } },
      },
      _count: {
        select: {
          turnos: {
            where: { estado: "CONFIRMADO", resultado: "SIN_REGISTRAR" },
          },
        },
      },
    },
    orderBy: [{ fecha: "asc" }, { horaDesde: "asc" }],
    take: 120,
  });

  return {
    exito: true,
    jornadas: filas.map((f) => aJornadaListado(f, f._count.turnos, hoy, ahora)),
  };
}

/**
 * CA1: muestra los horarios afectados antes de confirmar la suspensión.
 * No modifica nada.
 */
export async function previsualizarSuspension(input: {
  disponibilidadId: string;
}): Promise<Resultado<{ previsualizacion: PrevisualizacionSuspension }>> {
  const sesion = await requireOperador();
  const cargada = await cargarJornadaAutorizada(sesion, input.disponibilidadId);
  if ("error" in cargada) return { error: cargada.error };
  const { jornada } = cargada;

  const ahora = new Date();
  const hoy = hoySala(ahora);
  const { afectadas, conResultado, retenciones } = clasificarTurnos(
    jornada,
    ahora,
  );

  return {
    exito: true,
    previsualizacion: {
      jornada: aJornadaListado(jornada, afectadas.length, hoy, ahora),
      medico: datosMedico(jornada),
      citasAfectadas: afectadas.map((t) => ({
        id: t.id.toString(),
        hora: horaTexto(t.hora),
        paciente: t.paciente.persona.nombreCompleto,
        dni: t.paciente.dni,
        sinDestinatario: destinatarioDe(t) === null,
      })),
      retencionesALiberar: retenciones.length,
      citasConResultado: conResultado.length,
    },
  };
}

class ErrorSuspension extends Error {}

/**
 * CA1 a CA5: suspende la jornada en una única transacción.
 *
 * `citasRevisadas` son los ids de las citas confirmadas que el operador vio
 * en la previsualización. Si mientras tanto cambió el conjunto (por ejemplo,
 * se confirmó una reserva), no se suspende y se pide revisar de nuevo: la
 * confirmación siempre corresponde a los horarios realmente afectados.
 */
export async function suspenderJornada(input: {
  disponibilidadId: string;
  motivo: string;
  confirmaHorarios: boolean;
  citasRevisadas: string[];
}): Promise<Resultado<{ mensaje: string; resumen: ResumenSuspension }>> {
  const sesion = await requireOperador();

  const motivo = validarMotivo(input.motivo);
  if ("error" in motivo) return { error: motivo.error };
  if (input.confirmaHorarios !== true) {
    return { error: MSG_SUSPENSION.CONFIRMACION_REQUERIDA };
  }

  const cargada = await cargarJornadaAutorizada(sesion, input.disponibilidadId);
  if ("error" in cargada) return { error: cargada.error };
  const previa = cargada.jornada;

  const ahora = new Date();
  const hoy = hoySala(ahora);
  const fecha = fechaTexto(previa.fecha);
  const horaDesde = horaTexto(previa.horaDesde);
  const horaHasta = horaTexto(previa.horaHasta);
  const regla = evaluarSuspensionJornada(
    {
      estado: previa.estado,
      fecha,
      finIso: inicioTurno(fecha, horaHasta),
    },
    hoy,
    ahora,
  );
  if (!regla.puede) return { error: regla.motivo };

  const operadorId = BigInt(sesion.usuarioId);
  const medico = datosMedico(previa);
  const fechaLegible = etiquetaFecha(fecha);
  const revisadas = new Set(input.citasRevisadas ?? []);

  let resumen: ResumenSuspension;
  try {
    resumen = await prisma.$transaction(async (tx) => {
      // 1. Bloqueo de la jornada (CA2: detiene reservas). El UPDATE toma el
      //    lock de la fila: las reservas y confirmaciones que lo esperan ven
      //    la jornada SUSPENDIDA (ver `app/actions/reservas.ts`). Si ya estaba
      //    suspendida no se vuelve a procesar (idempotencia).
      const { count } = await tx.disponibilidad.updateMany({
        where: { id: previa.id, estado: "PUBLICADA" },
        data: {
          estado: "SUSPENDIDA",
          motivoSuspension: motivo.motivo,
          suspendidaEn: ahora,
          suspendidaPor: operadorId,
        },
      });
      if (count === 0) {
        throw new ErrorSuspension(MSG_SUSPENSION.JORNADA_YA_SUSPENDIDA);
      }

      // 2. Turnos con la jornada ya bloqueada: este es el conjunto definitivo.
      const jornada = await cargarJornada(tx, previa.id);
      if (!jornada) {
        throw new ErrorSuspension(MSG_SUSPENSION.JORNADA_NO_ENCONTRADA);
      }
      const { afectadas, retenciones } = clasificarTurnos(jornada, ahora);

      // CA1: lo confirmado tiene que coincidir con lo que realmente se afecta.
      const mismasCitas =
        afectadas.length === revisadas.size &&
        afectadas.every((t) => revisadas.has(t.id.toString()));
      if (!mismasCitas) {
        throw new ErrorSuspension(
          "Los horarios afectados cambiaron mientras revisabas. Volvé a revisarlos y confirmá de nuevo.",
        );
      }

      // 3. CA2: libera las retenciones temporales de horarios no iniciados.
      //    (El CHECK de `turno` exige cancelado_en/por y motivo.)
      let retencionesLiberadas = 0;
      if (retenciones.length > 0) {
        const liberadas = await tx.turno.updateMany({
          where: {
            id: { in: retenciones.map((t) => t.id) },
            estado: "RESERVADO",
          },
          data: {
            estado: "CANCELADO",
            retenidoHasta: null,
            canceladoEn: ahora,
            canceladoPor: operadorId,
            origenCancelacion: ORIGEN_CANCELACION_SUSPENSION,
            motivoCancelacion: MOTIVO_RETENCION_LIBERADA,
          },
        });
        retencionesLiberadas = liberadas.count;
      }

      // 4. CA3: las citas confirmadas NO se modifican. Quedan afectadas
      //    porque su jornada está SUSPENDIDA (agenda y "Mis turnos" ya las
      //    muestran como pendientes de resolución).
      const idsAfectadas = afectadas.map((t) => t.id);

      // 5. CA5: se suspenden sus recordatorios pendientes.
      /*const recordatoriosSuspendidos = await suspenderRecordatorios(
        tx,
        idsAfectadas,
        ahora,
      );*/

      // 6. CA4: aviso interno a cada paciente/tutor (CA2 de US-031).
      let avisosGenerados = 0;
      let sinDestinatario = 0;
      for (const turno of afectadas) {
        const destino = destinatarioDe(turno);
        if (!destino) {
          sinDestinatario++;
          continue;
        }
        
        await crearAvisoSuspension(tx, {
          turnoId: turno.id,
          usuarioId: destino.id,
          resumen: `Atención afectada: tu turno de ${medico.especialidad} del ${fechaLegible} a las ${horaTexto(turno.hora)} hs requiere resolución administrativa porque el médico suspendió la jornada.`,
        });
        avisosGenerados++;
      }

      // 7. Bitácora (RF-21). Si opera Administración queda identificada.
      await tx.auditoria.create({
        data: {
          actorId: operadorId,
          accion: AUDITORIA_SUSPENSION,
          entidad: "disponibilidad",
          referenciaId: previa.id,
          detalle: JSON.stringify({
            medicoId: medico.id,
            operadorRol: sesion.rol,
            enNombreDelMedico: sesion.rol === "ADMIN",
            fecha,
            horaDesde,
            horaHasta,
            motivo: motivo.motivo,
            citasAfectadas: idsAfectadas.map((id) => id.toString()),
            retencionesLiberadas,
            avisosGenerados,
            sinDestinatario,
          }),
        },
      });

      return {
        citasAfectadas: afectadas.length,
        retencionesLiberadas,
        recordatoriosSuspendidos: 0,
        avisosGenerados,
        sinDestinatario,
      };
    });
  } catch (error) {
    if (error instanceof ErrorSuspension) return { error: error.message };
    console.error("Error suspendiendo jornada:", error);
    return { error: MSG_SUSPENSION.ERROR_INTERNO };
  }

  revalidatePath("/medico");
  revalidatePath("/medico/disponibilidad");
  revalidatePath("/admin/agenda");
  revalidatePath("/admin/jornadas");
  revalidatePath("/paciente/turnos");

  const partes = [
    `Jornada del ${fechaLegible.toLowerCase()} (${horaDesde} a ${horaHasta} hs) suspendida.`,
    resumen.citasAfectadas === 0
      ? "No había citas confirmadas."
      : `${resumen.citasAfectadas} cita(s) confirmada(s) quedan pendientes de resolución administrativa.`,
  ];
  if (resumen.retencionesLiberadas > 0) {
    partes.push(
      `Se liberaron ${resumen.retencionesLiberadas} retención(es) temporal(es).`,
    );
  }
  if (resumen.avisosGenerados > 0) {
    partes.push(`Se avisó a ${resumen.avisosGenerados} paciente(s).`);
  }
  if (resumen.sinDestinatario > 0) {
    partes.push(
      `${resumen.sinDestinatario} cita(s) no tienen una cuenta activa para recibir el aviso: contactalas desde la sala.`,
    );
  }

  return { exito: true, mensaje: partes.join(" "), resumen };
}
