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

const NOMBRE_DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Fecha de hoy en la sala (Argentina) como YYYY-MM-DD. */
function hoyEnLaSala(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** "HH:mm" -> minutos desde las 00:00, o null si el formato no es válido. */
function aMinutos(hora: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hora ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function aHora(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

/** Columnas `time` de Prisma: DateTime con fecha base 1970-01-01 UTC (D-03). */
function minutosDeTime(valor: Date): number {
  return valor.getUTCHours() * 60 + valor.getUTCMinutes();
}

function fechaLegible(iso: string): string {
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

/**
 * CA2: el intervalo tiene que ser válido y contener turnos completos según la
 * duración del médico. Devuelve el mensaje de error o null si está bien.
 */
function validarIntervalo(
  horaDesde: string,
  horaHasta: string,
  duracion: number,
  nombre: string,
): { error: string } | { desde: number; hasta: number } {
  const desde = aMinutos(horaDesde);
  const hasta = aMinutos(horaHasta);
  if (desde === null || hasta === null) {
    return { error: `Completá el horario de inicio y fin del ${nombre}.` };
  }
  if (hasta <= desde) {
    return { error: `En el ${nombre}, la hora de fin tiene que ser posterior a la de inicio.` };
  }
  const largo = hasta - desde;
  if (largo % duracion !== 0) {
    const menor = desde + Math.floor(largo / duracion) * duracion;
    const mayor = desde + Math.ceil(largo / duracion) * duracion;
    const sugerencias = [menor > desde ? aHora(menor) : null, mayor < 24 * 60 ? aHora(mayor) : null]
      .filter(Boolean)
      .map((h) => `${horaDesde} a ${h}`)
      .join(" o ");
    return {
      error:
        `Con turnos de ${duracion} minutos, el intervalo del ${nombre} (${horaDesde} a ${horaHasta}) ` +
        `no queda en turnos completos.` +
        (sugerencias ? ` Probá con ${sugerencias}.` : ""),
    };
  }
  return { desde, hasta };
}

/** Lunes (YYYY-MM-DD) de la semana a la que pertenece la fecha. */
function lunesDeLaSemana(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  const desdeLunes = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - desdeLunes);
  return d.toISOString().slice(0, 10);
}

function sumarDiasIso(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export async function publicarDisponibilidadMensual(input: {
  mes: number; // 1 a 12
  anio: number;
  dias: DiaConfiguracion[];
}): Promise<ResultadoDisponibilidad> {
  // 1. Verificamos que sea un médico autenticado
  const sesionMedico = await requireRole("MEDICO");
  const profesionalId = BigInt(sesionMedico.usuarioId);

  const { mes, anio, dias } = input;

  // 2. Validación de la regla de la US-SIG-008 (CA1): exactamente 2 días distintos por semana
  if (!dias || dias.length !== 2) {
    return { error: "Tenés que elegir exactamente 2 días de atención por semana." };
  }
  if (dias[0].diaSemana === dias[1].diaSemana) {
    return { error: "Los 2 días de atención tienen que ser distintos." };
  }

  // 3. CA2: solo fechas futuras del año corriente.
  const hoy = hoyEnLaSala();
  const anioActual = Number(hoy.slice(0, 4));
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    return { error: "Elegí un mes válido." };
  }
  if (anio !== anioActual) {
    return { error: `Solo podés publicar disponibilidad del año en curso (${anioActual}).` };
  }
  const mesActual = Number(hoy.slice(5, 7));
  if (mes < mesActual) {
    return { error: "Ese mes ya pasó. Elegí el mes actual o uno posterior." };
  }

  // 4. CA2: el intervalo debe contener turnos completos según la duración del médico.
  const medico = await prisma.medico.findUnique({
    where: { usuarioId: profesionalId },
    select: { duracionTurnoMin: true },
  });
  if (!medico) {
    return { error: "Tu perfil de médico no está configurado. Pedile a Administración que lo revise." };
  }
  const duracion = medico.duracionTurnoMin;

  const intervalos = new Map<number, { desde: number; hasta: number }>();
  for (const dia of dias) {
    const nombre = NOMBRE_DIA[dia.diaSemana] ?? "el día elegido";
    const intervalo = validarIntervalo(dia.horaDesde, dia.horaHasta, duracion, nombre);
    if ("error" in intervalo) return { error: intervalo.error };
    intervalos.set(dia.diaSemana, intervalo);
  }

  // 5. Generamos las fechas del mes que caen en los días elegidos, solo desde mañana.
  //    Se trabaja en UTC para que la fecha no se corra según la zona del servidor.
  const cantidadDias = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const candidatas: { fecha: string; desde: number; hasta: number }[] = [];
  for (let dia = 1; dia <= cantidadDias; dia++) {
    const fechaUtc = new Date(Date.UTC(anio, mes - 1, dia));
    const intervalo = intervalos.get(fechaUtc.getUTCDay());
    if (!intervalo) continue;
    const fecha = fechaUtc.toISOString().slice(0, 10);
    if (fecha <= hoy) continue; // CA2: solo fechas futuras
    candidatas.push({ fecha, ...intervalo });
  }

  if (candidatas.length === 0) {
    return {
      error: "No quedan fechas futuras en ese mes para los días elegidos. Elegí un mes posterior.",
    };
  }

  // 6. CA2: no superponerse con otro intervalo del médico (y CA1: un solo intervalo por día).
  //    Repetir exactamente el mismo horario no es un error: se ignora (CA3, no duplica).
  const existentes = await prisma.disponibilidad.findMany({
    where: {
      profesionalId,
      fecha: { in: candidatas.map((c) => new Date(`${c.fecha}T00:00:00Z`)) },
    },
    select: { fecha: true, horaDesde: true, horaHasta: true },
  });

  const conflictos: string[] = [];
  const nuevas: typeof candidatas = [];
  let yaPublicadas = 0;
  for (const c of candidatas) {
    const delDia = existentes.filter((e) => e.fecha.toISOString().slice(0, 10) === c.fecha);
    if (delDia.length === 0) {
      nuevas.push(c);
      continue;
    }
    const igual = delDia.some(
      (e) => minutosDeTime(e.horaDesde) === c.desde && minutosDeTime(e.horaHasta) === c.hasta,
    );
    if (igual) {
      yaPublicadas++;
    } else {
      const otro = delDia[0];
      conflictos.push(
        `${fechaLegible(c.fecha)} (ya tiene ${aHora(minutosDeTime(otro.horaDesde))} a ${aHora(minutosDeTime(otro.horaHasta))})`,
      );
    }
  }

  if (conflictos.length > 0) {
    const muestra = conflictos.slice(0, 5).join(", ");
    const resto = conflictos.length > 5 ? ` y ${conflictos.length - 5} más` : "";
    return {
      error:
        `No se publicó nada: estas fechas ya tienen otro horario publicado y se superpondrían: ${muestra}${resto}.`,
    };
  }

  // 7. CA1 / CA4: ninguna semana puede quedar con más de 2 días de atención.
  //    Al cambiar los días de la semana de un mes ya publicado, el médico quita
  //    los días libres y publica la nueva configuración: los días con turnos se
  //    conservan y ocupan su lugar en la semana, así que en esas semanas se
  //    publican solo las fechas nuevas que entran (en orden) y el resto se saltea.
  const salteadas: string[] = [];
  if (nuevas.length > 0) {
    const lunes = nuevas.map((c) => lunesDeLaSemana(c.fecha)).sort();
    const desdeSemana = lunes[0];
    const hastaSemana = sumarDiasIso(lunes[lunes.length - 1], 6);
    const enSemanas = await prisma.disponibilidad.findMany({
      where: {
        profesionalId,
        fecha: {
          gte: new Date(`${desdeSemana}T00:00:00Z`),
          lte: new Date(`${hastaSemana}T00:00:00Z`),
        },
      },
      select: { fecha: true },
    });
    const porSemana = new Map<string, number>();
    for (const e of enSemanas) {
      const clave = lunesDeLaSemana(e.fecha.toISOString().slice(0, 10));
      porSemana.set(clave, (porSemana.get(clave) ?? 0) + 1);
    }
    const queEntran: typeof nuevas = [];
    for (const c of nuevas) {
      const clave = lunesDeLaSemana(c.fecha);
      const cantidad = porSemana.get(clave) ?? 0;
      if (cantidad >= 2) {
        salteadas.push(fechaLegible(c.fecha));
        continue;
      }
      porSemana.set(clave, cantidad + 1);
      queEntran.push(c);
    }
    nuevas.splice(0, nuevas.length, ...queEntran);
  }
  const avisoSalteadas =
    salteadas.length > 0
      ? ` No se publicaron ${salteadas.length} fechas (${salteadas.slice(0, 5).join(", ")}${salteadas.length > 5 ? "…" : ""}) porque esas semanas ya tienen 2 días de atención.`
      : "";

  if (nuevas.length === 0) {
    return {
      exito: true,
      mensaje:
        yaPublicadas > 0
          ? `No se crearon fechas nuevas para ${mes}/${anio}: ya estaban publicadas con estos horarios.${avisoSalteadas}`
          : `No se crearon fechas nuevas para ${mes}/${anio}.${avisoSalteadas}`,
    };
  }

  try {
    // 8. Inserción masiva. skipDuplicates cubre una publicación simultánea del mismo bloque.
    await prisma.disponibilidad.createMany({
      data: nuevas.map((c) => ({
        profesionalId,
        fecha: new Date(`${c.fecha}T00:00:00Z`),
        horaDesde: new Date(Date.UTC(1970, 0, 1, Math.floor(c.desde / 60), c.desde % 60)),
        horaHasta: new Date(Date.UTC(1970, 0, 1, Math.floor(c.hasta / 60), c.hasta % 60)),
        estado: "PUBLICADA" as const,
      })),
      skipDuplicates: true,
    });

    revalidatePath("/medico/disponibilidad");
    const extra = yaPublicadas > 0 ? ` (${yaPublicadas} ya estaban publicadas)` : "";
    return {
      exito: true,
      mensaje: `Disponibilidad de ${mes}/${anio} publicada: ${nuevas.length} fechas nuevas${extra}.${avisoSalteadas}`,
    };
  } catch (error) {
    console.error("Error guardando disponibilidad:", error);
    return { error: "Ocurrió un error interno al guardar la disponibilidad." };
  }
}

const NOMBRE_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export type ResultadoCopiaMesAnterior = {
  error?: string;
  dias?: DiaConfiguracion[];
  /** Ej.: "septiembre de 2026" */
  mesOrigen?: string;
};

/**
 * US-008 CA1: "la configuración puede copiarse del mes anterior".
 * Busca lo que el médico publicó el mes anterior al elegido y deduce sus
 * 2 días de la semana y el horario de cada uno. No publica nada: solo
 * devuelve la configuración para llenar el formulario.
 */
export async function obtenerConfiguracionMesAnterior(input: {
  mes: number; // mes que se quiere publicar (1 a 12)
  anio: number;
}): Promise<ResultadoCopiaMesAnterior> {
  const sesionMedico = await requireRole("MEDICO");
  const profesionalId = BigInt(sesionMedico.usuarioId);

  const { mes, anio } = input;
  if (!Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(anio)) {
    return { error: "Elegí un mes y un año válidos." };
  }

  // Mes anterior al elegido (enero -> diciembre del año anterior).
  const mesAnterior = mes === 1 ? 12 : mes - 1;
  const anioAnterior = mes === 1 ? anio - 1 : anio;
  const mesOrigen = `${NOMBRE_MES[mesAnterior - 1]} de ${anioAnterior}`;

  const primerDia = new Date(Date.UTC(anioAnterior, mesAnterior - 1, 1));
  const ultimoDia = new Date(Date.UTC(anioAnterior, mesAnterior, 0));

  const publicadas = await prisma.disponibilidad.findMany({
    where: {
      profesionalId,
      fecha: { gte: primerDia, lte: ultimoDia },
    },
    select: { fecha: true, horaDesde: true, horaHasta: true },
  });

  if (publicadas.length === 0) {
    return { error: `No tenés disponibilidad publicada en ${mesOrigen} para copiar.` };
  }

  // Por cada día de la semana se cuenta cuántas veces aparece cada horario.
  const porDia = new Map<number, Map<string, number>>();
  for (const p of publicadas) {
    const diaSemana = p.fecha.getUTCDay();
    const horario = `${aHora(minutosDeTime(p.horaDesde))}-${aHora(minutosDeTime(p.horaHasta))}`;
    const conteo = porDia.get(diaSemana) ?? new Map<string, number>();
    conteo.set(horario, (conteo.get(horario) ?? 0) + 1);
    porDia.set(diaSemana, conteo);
  }

  // Los 2 días más usados, cada uno con su horario más frecuente.
  const total = (conteo: Map<string, number>) =>
    [...conteo.values()].reduce((a, b) => a + b, 0);
  const dias: DiaConfiguracion[] = [...porDia.entries()]
    .sort((a, b) => total(b[1]) - total(a[1]) || a[0] - b[0])
    .slice(0, 2)
    .map(([diaSemana, conteo]) => {
      const [horario] = [...conteo.entries()].sort((a, b) => b[1] - a[1])[0];
      const [horaDesde, horaHasta] = horario.split("-");
      return { diaSemana, horaDesde, horaHasta };
    })
    .sort((a, b) => a.diaSemana - b.diaSemana);

  return { dias, mesOrigen };
}

// ---------------------------------------------------------------------------
// US-008 CA4: ver y editar los días ya publicados.
// Solo se editan días futuros sin citas confirmadas ni retenciones activas.
// ---------------------------------------------------------------------------

export type DiaPublicado = {
  id: string;
  fecha: string; // YYYY-MM-DD
  horaDesde: string; // HH:mm
  horaHasta: string; // HH:mm
  estado: "PUBLICADA" | "SUSPENDIDA";
  /** Turnos confirmados + retenciones vigentes (lo que bloquea la edición). */
  ocupados: number;
  /** Tuvo algún turno alguna vez (aunque esté cancelado): no se puede borrar. */
  tieneHistorial: boolean;
  pasado: boolean;
  editable: boolean;
};

export type ResultadoListado = { error?: string; dias?: DiaPublicado[] };

/** Turnos que bloquean la edición: confirmados o retenidos con retención vigente. */
function filtroTurnosQueBloquean(ahora: Date) {
  return {
    OR: [
      { estado: "CONFIRMADO" as const },
      { estado: "RESERVADO" as const, retenidoHasta: { gt: ahora } },
    ],
  };
}

export async function listarDisponibilidadMes(input: {
  mes: number;
  anio: number;
}): Promise<ResultadoListado> {
  const sesionMedico = await requireRole("MEDICO");
  const profesionalId = BigInt(sesionMedico.usuarioId);
  const { mes, anio } = input;
  if (!Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(anio)) {
    return { error: "Elegí un mes y un año válidos." };
  }

  const ahora = new Date();
  const hoy = hoyEnLaSala();
  const filas = await prisma.disponibilidad.findMany({
    where: {
      profesionalId,
      fecha: {
        gte: new Date(Date.UTC(anio, mes - 1, 1)),
        lte: new Date(Date.UTC(anio, mes, 0)),
      },
    },
    select: {
      id: true,
      fecha: true,
      horaDesde: true,
      horaHasta: true,
      estado: true,
      turnos: { where: filtroTurnosQueBloquean(ahora), select: { id: true } },
      _count: { select: { turnos: true } },
    },
    orderBy: [{ fecha: "asc" }, { horaDesde: "asc" }],
  });

  return {
    dias: filas.map((f) => {
      const fecha = f.fecha.toISOString().slice(0, 10);
      const pasado = fecha <= hoy;
      const ocupados = f.turnos.length;
      return {
        id: f.id.toString(),
        fecha,
        horaDesde: aHora(minutosDeTime(f.horaDesde)),
        horaHasta: aHora(minutosDeTime(f.horaHasta)),
        estado: f.estado,
        ocupados,
        tieneHistorial: f._count.turnos > 0,
        pasado,
        editable: !pasado && ocupados === 0 && f.estado === "PUBLICADA",
      };
    }),
  };
}

/** Carga un día del médico logueado y verifica que se pueda editar. */
async function cargarDiaEditable(
  id: string,
  profesionalId: bigint,
): Promise<
  | { error: string }
  | { dia: { id: bigint; fecha: Date; estado: string }; totalTurnos: number }
> {
  let idBig: bigint;
  try {
    idBig = BigInt(id);
  } catch {
    return { error: "El día elegido no existe." };
  }
  const ahora = new Date();
  const dia = await prisma.disponibilidad.findUnique({
    where: { id: idBig },
    select: {
      id: true,
      fecha: true,
      estado: true,
      profesionalId: true,
      turnos: { where: filtroTurnosQueBloquean(ahora), select: { id: true } },
      _count: { select: { turnos: true } },
    },
  });
  // Un día de otro médico no existe para este médico.
  if (!dia || dia.profesionalId !== profesionalId) {
    return { error: "El día elegido no existe." };
  }
  if (dia.fecha.toISOString().slice(0, 10) <= hoyEnLaSala()) {
    return { error: "Solo se pueden modificar días futuros." };
  }
  if (dia.estado !== "PUBLICADA") {
    return { error: "Ese día está suspendido y no se puede modificar desde acá." };
  }
  if (dia.turnos.length > 0) {
    return {
      error:
        "Ese día tiene turnos confirmados o retenciones activas, así que no se puede modificar.",
    };
  }
  return { dia, totalTurnos: dia._count.turnos };
}

export async function editarHorarioDia(input: {
  id: string;
  horaDesde: string;
  horaHasta: string;
}): Promise<ResultadoDisponibilidad> {
  const sesionMedico = await requireRole("MEDICO");
  const profesionalId = BigInt(sesionMedico.usuarioId);

  const cargado = await cargarDiaEditable(input.id, profesionalId);
  if ("error" in cargado) return { error: cargado.error };
  const { dia } = cargado;

  const medico = await prisma.medico.findUnique({
    where: { usuarioId: profesionalId },
    select: { duracionTurnoMin: true },
  });
  if (!medico) {
    return { error: "Tu perfil de médico no está configurado. Pedile a Administración que lo revise." };
  }

  const nombre = `día ${fechaLegible(dia.fecha.toISOString().slice(0, 10))}`;
  const intervalo = validarIntervalo(input.horaDesde, input.horaHasta, medico.duracionTurnoMin, nombre);
  if ("error" in intervalo) return { error: intervalo.error };

  try {
    // Se vuelve a controlar dentro de la transacción por si entró una reserva.
    await prisma.$transaction(async (tx) => {
      const bloqueantes = await tx.turno.count({
        where: { disponibilidadId: dia.id, ...filtroTurnosQueBloquean(new Date()) },
      });
      if (bloqueantes > 0) throw new Error("OCUPADO");
      await tx.disponibilidad.update({
        where: { id: dia.id },
        data: {
          horaDesde: new Date(Date.UTC(1970, 0, 1, Math.floor(intervalo.desde / 60), intervalo.desde % 60)),
          horaHasta: new Date(Date.UTC(1970, 0, 1, Math.floor(intervalo.hasta / 60), intervalo.hasta % 60)),
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "OCUPADO") {
      return { error: "Mientras editabas se reservó un turno en ese día. Ya no se puede modificar." };
    }
    console.error("Error editando disponibilidad:", error);
    return { error: "Ocurrió un error interno al guardar el cambio." };
  }

  revalidatePath("/medico/disponibilidad");
  return {
    exito: true,
    mensaje: `Horario del ${fechaLegible(dia.fecha.toISOString().slice(0, 10))} actualizado: ${aHora(intervalo.desde)} a ${aHora(intervalo.hasta)}.`,
  };
}

export async function quitarDiaDisponibilidad(input: {
  id: string;
}): Promise<ResultadoDisponibilidad> {
  const sesionMedico = await requireRole("MEDICO");
  const profesionalId = BigInt(sesionMedico.usuarioId);

  const cargado = await cargarDiaEditable(input.id, profesionalId);
  if ("error" in cargado) return { error: cargado.error };
  const { dia, totalTurnos } = cargado;

  // No se borran registros con historia: si tuvo turnos (aunque cancelados), se conserva.
  if (totalTurnos > 0) {
    return {
      error:
        "Ese día tuvo turnos cancelados y se conserva su historial, así que no se puede quitar. Podés cambiarle el horario.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const turnos = await tx.turno.count({ where: { disponibilidadId: dia.id } });
      if (turnos > 0) throw new Error("OCUPADO");
      await tx.disponibilidad.delete({ where: { id: dia.id } });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "OCUPADO") {
      return { error: "Mientras lo quitabas se reservó un turno en ese día. Ya no se puede quitar." };
    }
    console.error("Error quitando disponibilidad:", error);
    return { error: "Ocurrió un error interno al quitar el día." };
  }

  revalidatePath("/medico/disponibilidad");
  return {
    exito: true,
    mensaje: `Se quitó el ${fechaLegible(dia.fecha.toISOString().slice(0, 10))} de tu disponibilidad.`,
  };
}