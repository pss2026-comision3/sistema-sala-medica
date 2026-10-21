import { prisma } from "@/lib/db/prisma";
import { crearAvisoRecordatorio } from "@/lib/notificaciones/avisos";
import { notificarPorEmail, destinatarioDeTurno } from "@/lib/notificaciones/email-turno";

export async function procesarRecordatorios() {
  const ahora = new Date();
  
// 24 horas (regla de negocio) - 3 horas de desfasaje de Argentina (UTC-3) = 21 horas reales.
  // Busca turnos guardados entre 21 y 22 horas de distancia absoluta.
  const ventanaInicio = new Date(ahora.getTime() + 21 * 60 * 60 * 1000); 
  const ventanaFin = new Date(ventanaInicio.getTime() + 60 * 60 * 1000);

  // 1. Buscar los turnos elegibles cumpliendo las reglas de negocio (US-SIG-032)
  const turnosCandidatos = await prisma.turno.findMany({
    where: {
      estado: "CONFIRMADO", 
      resultado: "SIN_REGISTRAR", 
      hora: {
        gte: ventanaInicio,
        lt: ventanaFin
      },
      disponibilidad: {
        estado: "PUBLICADA" 
      }
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

  console.log(`[CRON Recordatorios] Procesando ${turnosCandidatos.length} turnos para la ventana de 24hs.`);

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