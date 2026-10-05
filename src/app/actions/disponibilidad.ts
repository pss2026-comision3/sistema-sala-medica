"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/guards";

export type ResultadoDisponibilidad = {
  error?: string;
  exito?: boolean;
  mensaje?: string;
};

export type DiaConfiguracion = {
  diaSemana: number; // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  horaDesde: string; // formato "HH:mm"
  horaHasta: string; // formato "HH:mm"
};

export async function publicarDisponibilidadMensual(input: {
  mes: number; // 1 a 12
  anio: number;
  dias: DiaConfiguracion[];
}): Promise<ResultadoDisponibilidad> {
  // 1. Verificamos que sea un médico autenticado
  const sesionMedico = await requireRole("MEDICO");

  const { mes, anio, dias } = input;

  // 2. Validación de la regla de la US-SIG-008: Máximo 2 días por semana
  if (!dias || dias.length === 0 || dias.length > 2) {
    return { error: "Debes seleccionar 1 o 2 días a la semana como máximo." };
  }

  // 3. Generamos todos los registros del mes
  const registros = [];
  // Cuidado con los meses en JS: 0 es Enero, 11 es Diciembre.
  const fechaIterador = new Date(anio, mes - 1, 1);

  while (fechaIterador.getMonth() === mes - 1) {
    const diaSemanaActual = fechaIterador.getDay();
    const confDia = dias.find((d) => d.diaSemana === diaSemanaActual);

    if (confDia) {
      // Formateamos la fecha base para Prisma (@db.Date)
      const fechaStr = fechaIterador.toISOString().split("T")[0];
      
      // Parseamos las horas para Prisma (@db.Time) - Usamos UTC para evitar desfasajes horarios
      const [hD, mD] = confDia.horaDesde.split(":");
      const [hH, mH] = confDia.horaHasta.split(":");
      
      registros.push({
        profesionalId: BigInt(sesionMedico.usuarioId),
        fecha: new Date(`${fechaStr}T00:00:00Z`),
        horaDesde: new Date(Date.UTC(1970, 0, 1, parseInt(hD), parseInt(mD))),
        horaHasta: new Date(Date.UTC(1970, 0, 1, parseInt(hH), parseInt(mH))),
        estado: "PUBLICADA" as const,
      });
    }
    // Avanzamos al día siguiente
    fechaIterador.setDate(fechaIterador.getDate() + 1);
  }

  if (registros.length === 0) {
    return { error: "No se generaron fechas válidas para el mes seleccionado." };
  }

  try {
    // 4. Inserción masiva ignorando los que ya existan (@@unique del schema)
    await prisma.disponibilidad.createMany({
      data: registros,
      skipDuplicates: true,
    });

    revalidatePath("/medico/disponibilidad");
    return {
      exito: true,
      mensaje: `Disponibilidad publicada con éxito para el mes de ${mes}/${anio}.`,
    };
  } catch (error) {
    console.error("Error guardando disponibilidad:", error);
    return { error: "Ocurrió un error interno al guardar la disponibilidad." };
  }
}