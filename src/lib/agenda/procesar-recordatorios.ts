import { prisma } from "@/lib/db/prisma";
import { crearAvisoRecordatorio, EVENTO_RECORDATORIO } from "@/lib/notificaciones/avisos";
import { notificarPorEmail, destinatarioDeTurno } from "@/lib/notificaciones/email-turno";
import { hoySala } from "@/lib/agenda/reglas";

export async function procesarRecordatorios() {
  // shortcut: el plan Hobby de Vercel solo permite crons diarios (vercel.json, 09:00 AR),
  // así que se recuerdan los turnos del día siguiente; con plan Pro se puede volver a una ventana de 24 hs exactas.
  const manana = new Date(`${hoySala()}T00:00:00Z`);
  manana.setUTCDate(manana.getUTCDate() + 1);

  // 1. Buscar los turnos elegibles cumpliendo las reglas de negocio (US-SIG-032)
  const turnosCandidatos = await prisma.turno.findMany({
    where: {
      estado: "CONFIRMADO",
      resultado: "SIN_REGISTRAR",
      disponibilidad: {
        estado: "PUBLICADA",
        fecha: manana
      },
      // Evita recordar dos veces el mismo turno si el cron se dispara más de una vez.
      avisoInternos: { none: { evento: EVENTO_RECORDATORIO } }
    },
    include: {
      vacuna: { select: { nombre: true } },
      disponibilidad: {
        select: {
          fecha: true,
          profesional: {
            select: { medico: { select: { especialidad: { select: { nombre: true } } } } }
          }
        }
      }
    }
  });

  console.log(`[CRON Recordatorios] Procesando ${turnosCandidatos.length} turnos del ${manana.toISOString().slice(0, 10)}.`);

  for (const turno of turnosCandidatos) {
    const destino = await destinatarioDeTurno(prisma, turno.id);
    if (!destino) {
      console.warn(`[CRON Recordatorios] Turno ${turno.id}: Ignorado (sin destinatario)`);
      continue;
    }

    const fechaFormat = turno.disponibilidad.fecha.toISOString().slice(0, 10);
    const horaFormat = turno.hora.toISOString().slice(11, 16);
    const prestacion = turno.tipo === "VACUNACION"
      ? (turno.vacuna?.nombre ?? "Vacunación")
      : (turno.disponibilidad.profesional.medico?.especialidad?.nombre ?? "Consulta médica");

    try {
      // 2. Transacción: Insertar aviso interno
      await prisma.$transaction(async (tx) => {
        await crearAvisoRecordatorio(tx, {
          turnoId: turno.id,
          usuarioId: destino.usuarioId,
          resumen: `Recordatorio: Tenés un turno de ${prestacion} programado para el ${fechaFormat} a las ${horaFormat} hs.`
        });
      });

      // 3. Disparar Email
      notificarPorEmail("RECORDATORIO", turno.id);

    } catch (e) {
      console.error(`[CRON Recordatorios] Error procesando turno ${turno.id}:`, e);
    }
  }
}