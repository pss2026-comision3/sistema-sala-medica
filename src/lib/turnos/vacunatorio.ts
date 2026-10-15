import { evaluarRegistroAusencia, hoySala, inicioTurno } from "@/lib/agenda/reglas";
import type {
  EstadoJornadaAgenda,
  EstadoTurnoAgenda,
  ResultadoAgenda,
} from "@/lib/agenda/tipos";
import { prisma } from "@/lib/db/prisma";

export type TurnoVacunatorio = {
  id: string;
  hora: string;
  vacuna: string;
  paciente: string;
  estado: EstadoTurnoAgenda;
  resultado: ResultadoAgenda;
  puedeRegistrarAusencia: boolean;
  motivoNoRegistrar: string;
};

/**
 * US-SIG-016 (vacunatorio): citas de vacunación de la jornada de hoy, con la
 * regla de ausencia ya evaluada. La reserva de vacunas (US-022/US-023) llega en
 * el Sprint 3; hasta entonces la lista queda vacía y la pantalla lo explica.
 */
export async function obtenerTurnosVacunatorioDelDia(
  ahora: Date = new Date(),
): Promise<TurnoVacunatorio[]> {
  const hoy = hoySala(ahora);

  const filas = await prisma.turno.findMany({
    where: {
      tipo: "VACUNACION",
      disponibilidad: { fecha: new Date(`${hoy}T00:00:00Z`) },
    },
    select: {
      id: true,
      hora: true,
      duracionMin: true,
      estado: true,
      resultado: true,
      vacuna: { select: { nombre: true } },
      paciente: { select: { persona: { select: { nombreCompleto: true } } } },
      disponibilidad: { select: { fecha: true, estado: true } },
    },
    orderBy: { hora: "asc" },
  });

  return filas.map((fila) => {
    const hora = fila.hora.toISOString().slice(11, 16);
    const fecha = fila.disponibilidad.fecha.toISOString().slice(0, 10);
    const regla = evaluarRegistroAusencia(
      {
        estado: fila.estado as EstadoTurnoAgenda,
        resultado: fila.resultado as ResultadoAgenda,
        inicio: inicioTurno(fecha, hora),
        duracionMin: fila.duracionMin,
      },
      {
        fecha,
        horaDesde: hora,
        horaHasta: hora,
        estado: fila.disponibilidad.estado as EstadoJornadaAgenda,
      },
      ahora,
    );

    return {
      id: fila.id.toString(),
      hora,
      vacuna: fila.vacuna?.nombre ?? "Vacunación",
      paciente: fila.paciente.persona.nombreCompleto,
      estado: fila.estado as EstadoTurnoAgenda,
      resultado: fila.resultado as ResultadoAgenda,
      puedeRegistrarAusencia: regla.puede,
      motivoNoRegistrar: regla.motivo,
    };
  });
}
