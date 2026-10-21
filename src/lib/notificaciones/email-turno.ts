import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { inicioTurno } from "@/lib/agenda/reglas";
import {
  emailCancelacion,
  emailConfirmacion,
  emailSuspension,
  type DatosCita,
} from "@/lib/email/templates";
import {
  enviarAvisoEmail,
  type ResultadoEmail,
} from "@/lib/email/enviar-aviso";

/*
 * US-SIG-031 — Email de avisos de turno (CA1, CA2, CA3, CA4, CA5, CA6).
 *
 * Se llama DESPUES de que la transaccion de la operacion original termino
 * bien. Nunca lanza ni bloquea: un fallo de email no revierte nada (CA6).
 *
 * - EventoEmail: un registro por (tipo, turno). `claveEvento` es unica, asi
 *   que repetir la operacion no genera un segundo email (CA4).
 * - IntentoEmail: un registro por intento (EXITO / FALLIDO) con el error.
 */

export type TipoAvisoEmail = "CONFIRMACION" | "CANCELACION" | "SUSPENSION";

const SELECT_USUARIO = {
  select: { id: true, email: true, activo: true },
} as const;

async function cargarTurno(db: Prisma.TransactionClient, turnoId: bigint) {
  return db.turno.findUnique({
    where: { id: turnoId },
    select: {
      id: true,
      estado: true,
      hora: true,
      tipo: true,
      vacuna: { select: { nombre: true } },
      disponibilidad: {
        select: {
          fecha: true,
          estado: true,
          profesional: {
            select: {
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
            select: { nombreCompleto: true, usuario: SELECT_USUARIO },
          },
          tutor: {
            select: { persona: { select: { usuario: SELECT_USUARIO } } },
          },
        },
      },
    },
  });
}

type TurnoMail = NonNullable<Awaited<ReturnType<typeof cargarTurno>>>;

/** CA1: paciente adulto con cuenta activa o, si no tiene, su tutor vigente. */
function destinoDe(t: TurnoMail) {
  const propio = t.paciente.persona.usuario;
  if (propio?.activo) return propio;
  const tutor = t.paciente.tutor?.persona.usuario;
  if (tutor?.activo) return tutor;
  return null;
}

/** Para crear el aviso interno con el mismo destinatario que el email. */
export async function destinatarioDeTurno(
  db: Prisma.TransactionClient,
  turnoId: bigint,
) {
  const t = await cargarTurno(db, turnoId);
  const d = t ? destinoDe(t) : null;
  return d ? { usuarioId: d.id, email: d.email } : null;
}

/** CA6: el evento sigue vigente al momento del reintento. */
function sigueVigente(tipo: TipoAvisoEmail, t: TurnoMail): boolean {
  switch (tipo) {
    case "CONFIRMACION":
      return (
        t.estado === "CONFIRMADO" && t.disponibilidad.estado === "PUBLICADA"
      );
    case "CANCELACION":
      return t.estado === "CANCELADO";
    case "SUSPENSION":
      return (
        t.estado === "CONFIRMADO" && t.disponibilidad.estado === "SUSPENDIDA"
      );
  }
}

function datosCita(t: TurnoMail): DatosCita {
  const fecha = t.disponibilidad.fecha.toISOString().slice(0, 10);
  const hora = t.hora.toISOString().slice(11, 16);
  const prestacion =
    t.tipo === "VACUNACION"
      ? (t.vacuna?.nombre ?? "Vacunación")
      : (t.disponibilidad.profesional.medico?.especialidad?.nombre ??
        "Consulta médica");
  return {
    beneficiario: t.paciente.persona.nombreCompleto,
    prestacion,
    fecha: new Date(inicioTurno(fecha, hora)),
    detalleUrl: `${process.env.APP_URL ?? "http://localhost:3000"}/paciente/turnos`,
  };
}

function construirMensaje(tipo: TipoAvisoEmail, d: DatosCita) {
  switch (tipo) {
    case "CONFIRMACION":
      return emailConfirmacion(d);
    case "CANCELACION":
      return emailCancelacion(d);
    case "SUSPENSION":
      return emailSuspension(d);
  }
}

/** Solo para la demo: EMAIL_OVERRIDE_TO manda todos los mails a una casilla. */
const aDireccion = (email: string) => process.env.EMAIL_OVERRIDE_TO || email;

async function ejecutar(tipo: TipoAvisoEmail, turnoId: bigint) {
  try {
    const t = await cargarTurno(prisma, turnoId);
    if (!t) return;

    const destino = destinoDe(t);
    if (!destino) {
      console.warn(
        `[email] turno ${turnoId} (${tipo}): sin cuenta activa destinataria, no se envia email.`,
      );
      return;
    }

    const mensaje = construirMensaje(tipo, datosCita(t));

    // CA4: un unico evento por (tipo, turno). Si ya existe, no se reenvia.
    let eventoId: bigint;
    try {
      const evento = await prisma.eventoEmail.create({
        data: {
          destinatarioId: destino.id,
          turnoId,
          tipoEvento: tipo,
          claveEvento: `${tipo}:turno:${turnoId}`,
          emailDestinoSnapshot: destino.email,
          asunto: mensaje.subject,
          cuerpo: mensaje.text,
          programadoEn: new Date(),
        },
        select: { id: true },
      });
      eventoId = evento.id;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        return; // ya se proceso este evento
      }
      throw e;
    }

    const registrar = async (r: ResultadoEmail) => {
      await prisma.intentoEmail.create({
        data: {
          eventoId,
          numero: r.intento,
          resultado: r.estado === "ENVIADO" ? "EXITO" : "FALLIDO",
          error:
            r.estado === "OMITIDO"
              ? `Omitido: ${r.error ?? "evento ya no vigente"}`
              : (r.error ?? null),
        },
      });
    };

    await enviarAvisoEmail({
      destinatario: aDireccion(destino.email),
      mensaje,
      verificarVigencia: async () => {
        const actual = await cargarTurno(prisma, turnoId);
        if (!actual || !sigueVigente(tipo, actual)) return null;
        const d = destinoDe(actual);
        return d ? { destinatario: aDireccion(d.email) } : null;
      },
      registrarResultado: registrar,
    });
  } catch (e) {
    console.error("[email] error preparando el aviso:", e);
  }
}

/** Dispara el email sin esperar (fire-and-forget). Nunca lanza. */
export function notificarPorEmail(
  tipo: TipoAvisoEmail,
  turnoId: bigint,
): void {
  void ejecutar(tipo, turnoId);
}
