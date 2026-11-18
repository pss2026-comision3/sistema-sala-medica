import { prisma } from "@/lib/db/prisma";
import {
  EVENTO_RECORDATORIO,
  crearAvisoRecordatorio,
} from "@/lib/notificaciones/avisos";
import {
  destinatarioDeTurno,
  notificarPorEmail,
} from "@/lib/notificaciones/email-turno";
import {
  construirVentanaRecordatoriosDiaria,
  turnoEnVentana,
} from "@/lib/agenda/recordatorios-ventana";

/**
 * Procesa los recordatorios de turnos confirmados de hoy y mañana (cron
 * diario de Vercel), excluyendo los que ya comenzaron.
 *
 * Importante: `Turno.hora` es `time` en PostgreSQL y no puede compararse con
 * un timestamp. Se filtra por el día de la disponibilidad y se resuelve la
 * fecha/hora exacta en JS respetando America/Argentina/Buenos_Aires.
 */
export async function procesarRecordatorios() {
  const ventana = construirVentanaRecordatoriosDiaria();

  const turnosCandidatos = await prisma.turno.findMany({
    where: {
      estado: "CONFIRMADO",
      resultado: "SIN_REGISTRAR",
      disponibilidad: {
        estado: "PUBLICADA",
        fecha: { in: ventana.fechas },
      },
      // Evita duplicar el aviso interno si el cron se ejecuta dos veces.
      avisoInternos: {
        none: { evento: EVENTO_RECORDATORIO },
      },
    },
    include: {
      vacuna: { select: { nombre: true } },
      disponibilidad: {
        select: {
          fecha: true,
          profesional: {
            select: {
              medico: { select: { especialidad: { select: { nombre: true } } } },
            },
          },
        },
      },
    },
  });

  const turnos = turnosCandidatos
    .filter((turno) =>
      turnoEnVentana(
        turno.disponibilidad.fecha,
        turno.hora,
        ventana.ahora,
        ventana.hasta,
      ),
    )
    .sort((a, b) => {
      const inicioA = new Date(
        `${a.disponibilidad.fecha.toISOString().slice(0, 10)}T${a.hora
          .toISOString()
          .slice(11, 16)}:00-03:00`,
      ).getTime();
      const inicioB = new Date(
        `${b.disponibilidad.fecha.toISOString().slice(0, 10)}T${b.hora
          .toISOString()
          .slice(11, 16)}:00-03:00`,
      ).getTime();
      return inicioA - inicioB;
    });

  console.log(
    `[CRON Recordatorios] Procesando ${turnos.length} turnos para la ventana diaria (hoy y mañana).`,
  );

  for (const turno of turnos) {
    const destino = await destinatarioDeTurno(prisma, turno.id);
    if (!destino) {
      console.warn(
        `[CRON Recordatorios] Turno ${turno.id}: ignorado (sin destinatario)`,
      );
      continue;
    }

    const fechaFormat = turno.disponibilidad.fecha.toISOString().slice(0, 10);
    const horaFormat = turno.hora.toISOString().slice(11, 16);
    const prestacion =
      turno.tipo === "VACUNACION"
        ? (turno.vacuna?.nombre ?? "Vacunación")
        : (turno.disponibilidad.profesional.medico?.especialidad?.nombre ??
          "Consulta médica");

    try {
      await prisma.$transaction(async (tx) => {
        await crearAvisoRecordatorio(tx, {
          turnoId: turno.id,
          usuarioId: destino.usuarioId,
          resumen: `Recordatorio: tenés un turno de ${prestacion} programado para el ${fechaFormat} a las ${horaFormat} hs.`,
        });
      });

      notificarPorEmail("RECORDATORIO", turno.id);
    } catch (error) {
      console.error(
        `[CRON Recordatorios] Error procesando turno ${turno.id}:`,
        error,
      );
    }
  }
}
