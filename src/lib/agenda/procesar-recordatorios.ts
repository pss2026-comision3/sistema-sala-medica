import { prisma } from "@/lib/db/prisma";
import { crearAvisoRecordatorio } from "@/lib/notificaciones/avisos";
import { notificarPorEmail, destinatarioDeTurno } from "@/lib/notificaciones/email-turno";

/**
 * Motor principal para la US-SIG-032.
 * Debe ejecutarse periódicamente (ej: cada minuto) mediante un CRON.
 */
export async function procesarRecordatorios() {
  const ahora = new Date();
  
  // Rango de búsqueda: Citas que empiezan entre exactamente 24 horas y 24 horas + 1 minuto.
  // Esto asegura que no enviemos múltiples correos para el mismo turno en cronjobs sucesivos.
  const ventanaInicio = new Date(ahora.getTime() + 24 * 60 * 60 * 1000); 
  const ventanaFin = new Date(ventanaInicio.getTime() + 60 * 1000); // +1 min

  // Buscar los turnos elegibles (CA1, CA2)[cite: 20]
  const turnosCandidatos = await prisma.turno.findMany({
    where: {
      estado: "CONFIRMADO", // CA2[cite: 20]
      resultado: "SIN_REGISTRAR", // CA2[cite: 20]
      hora: {
        gte: ventanaInicio,
        lt: ventanaFin
      },
      disponibilidad: {
        estado: "PUBLICADA" // CA2 (agenda abierta)[cite: 20]
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

  for (const turno of turnosCandidatos) {
    // 1. Obtener el destinatario válido (adulto o tutor vigente) (CA3)[cite: 20]
    const destino = await destinatarioDeTurno(prisma, turno.id);
    
    if (!destino) {
      console.warn(`[Recordatorio] Turno ${turno.id}: sin destinatario activo.`);
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
        // CA1: Aviso interno
        await crearAvisoRecordatorio(tx, {
          turnoId: turno.id,
          usuarioId: destino.usuarioId,
          resumen: `Recordatorio: Tenés un turno de ${prestacion} programado para el ${fechaFormat} a las ${horaFormat} hs.`
        });
      });

      // 3. Disparar Email (fire-and-forget)
      notificarPorEmail("RECORDATORIO", turno.id);

    } catch (e) {
      console.error(`[Recordatorio] Error procesando turno ${turno.id}:`, e);
    }
  }
}