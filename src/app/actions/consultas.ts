"use server";

import { revalidatePath } from "next/cache";

import { AUDITORIA, MSG } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { inicioTurno } from "@/lib/agenda/reglas";
import {
  marcarTurnoAtendidoTx,
  validarCitaAptaParaConsulta,
} from "@/lib/turnos/resultado-atencion";
import type { ResultadoRegistroConsulta } from "@/lib/turnos/consulta-clinica";
import { esquemaAgregarCorreccion } from "@/lib/validations/consultas";

export async function registrarConsultaMedicaAction(
  formData: FormData,
): Promise<ResultadoRegistroConsulta> {
  // 1. Requiere rol MEDICO y sesión activa
  const sesion = await requireRole("MEDICO");
  const usuarioId = BigInt(sesion.usuarioId);

  // 2. Extraer datos y sanitizar
  const turnoIdRaw = formData.get("turnoId")?.toString().trim();
  const diagnostico = formData.get("diagnostico")?.toString().trim() ?? "";
  const sintomas = formData.get("sintomas")?.toString().trim() || null;
  const indicaciones = formData.get("indicaciones")?.toString().trim() || null;
  const medicacion = formData.get("medicacion")?.toString().trim() || null;
  const estudios = formData.get("estudios")?.toString().trim() || null;
  const observaciones =
    formData.get("observaciones")?.toString().trim() || null;
  const certificado = formData.get("certificado")?.toString().trim() || null;

  if (!turnoIdRaw) {
    return { exito: false, error: MSG.CONSULTA_CITA_NO_DISPONIBLE };
  }

  // CA2: El diagnóstico es obligatorio (no vacío tras trim).
  if (!diagnostico) {
    return { exito: false, error: MSG.CONSULTA_DIAGNOSTICO_REQUERIDO };
  }

  let turnoIdBig: bigint;
  try {
    turnoIdBig = BigInt(turnoIdRaw);
  } catch {
    return { exito: false, error: MSG.CONSULTA_CITA_NO_DISPONIBLE };
  }

  // 3. Buscar turno en Prisma
  const turno = await prisma.turno.findUnique({
    where: { id: turnoIdBig },
    include: {
      disponibilidad: true,
      consulta: true,
    },
  });

  if (!turno) {
    return { exito: false, error: MSG.CONSULTA_CITA_NO_DISPONIBLE };
  }

  // CA1 y CA5: Solo se registra sobre citas propias del médico.
  if (turno.disponibilidad.profesionalId !== usuarioId) {
    return { exito: false, error: MSG.CONSULTA_CITA_NO_DISPONIBLE };
  }

  // CA3: Idempotencia. Solo existe una consulta inicial por cita.
  if (turno.consulta) {
    return { exito: false, error: MSG.CONSULTA_YA_ATENDIDA };
  }

  // CA1: Cita médica confirmada, no suspendida, inicio alcanzado y resultado Sin registrar.
  const fechaStr = turno.disponibilidad.fecha.toISOString().slice(0, 10);
  const horaStr = turno.hora.toISOString().slice(11, 16);
  const inicioIso = inicioTurno(fechaStr, horaStr);

  const validacion = validarCitaAptaParaConsulta({
    estado: turno.estado,
    resultado: turno.resultado,
    inicio: inicioIso,
    jornadaSuspendida: turno.disponibilidad.estado === "SUSPENDIDA",
  });

  if (!validacion.puede) {
    return { exito: false, error: validacion.motivo };
  }

  // 4. Persistir consulta y marcar ATENDIDO en transacción atómica (CA3)
  const ahora = new Date();
  try {
    const consultaCreada = await prisma.$transaction(async (tx) => {
      // a) Insertar la consulta
      const nueva = await tx.consulta.create({
        data: {
          turnoId: turno.id,
          autorId: usuarioId,
          diagnostico,
          sintomas,
          indicaciones,
          medicacion,
          estudios,
          observaciones,
          certificado,
          creadaEn: ahora,
        },
      });

      // b) Actualizar el turno a ATENDIDO (US-017 CA3 / US-016 CA1)
      await marcarTurnoAtendidoTx(tx, turno.id, ahora);

      // c) Registrar auditoría
      await tx.auditoria.create({
        data: {
          actorId: usuarioId,
          accion: AUDITORIA.REGISTRO_CONSULTA_MEDICA,
          entidad: "consulta",
          referenciaId: turno.id,
          detalle: JSON.stringify({
            turnoId: turno.id.toString(),
            pacienteId: turno.pacienteId.toString(),
            creadaEn: ahora.toISOString(),
          }),
        },
      });

      return nueva;
    });

    revalidatePath(`/medico/turnos/${turnoIdRaw}`);
    revalidatePath("/medico");

    return {
      exito: true,
      consultaId: consultaCreada.turnoId.toString(),
      mensaje: MSG.CONSULTA_REGISTRADA_EXITO,
    };
  } catch (error) {
    console.error("Error al registrar consulta médica:", error);
    return {
      exito: false,
      error: "Ocurrió un error inesperado al registrar la consulta médica.",
    };
  }
}

export type FormState = {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
};

/**
 * Permite al médico agregar correcciones a una consulta ya registrada
 * @param prevState
 * @param formData
 * @returns
 */
export async function agregarCorreccion(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const medico = await requireRole("MEDICO");

  const datosForm = {
    turnoId: formData.get("turnoId") as string,
    motivo: formData.get("motivo") as string,
    texto: formData.get("texto") as string,
  };

  const validacion = esquemaAgregarCorreccion.safeParse(datosForm);

  if (!validacion.success) {
    return {
      success: false,
      errors: validacion.error.flatten().fieldErrors,
      message: "Por favor, completá todos los campos requeridos.",
    };
  }

  const { turnoId, motivo, texto } = validacion.data;
  const idObjetivo = BigInt(turnoId);

  try {
    // Buscamos la consulta original para validar la autoría (CA1)
    const consultaOriginal = await prisma.consulta.findUnique({
      where: { turnoId: idObjetivo },
      select: { autorId: true },
    });

    if (!consultaOriginal) {
      return {
        success: false,
        message: "La consulta original a la que intentás acceder no existe.",
      };
    }

    // Verificamos que el usuario logueado sea el autor original (CA1)
    if (consultaOriginal.autorId !== BigInt(medico.usuarioId)) {
      return {
        success: false,
        message:
          "Acceso denegado: solo el médico autor de la consulta puede agregarle correcciones.",
      };
    }

    // Mutación: Creamos el registro de corrección (CA2, CA4, CA5)
    await prisma.correccion.create({
      data: {
        consultaTurnoId: idObjetivo,
        autorId: BigInt(medico.usuarioId),
        texto: texto,
        motivo: motivo,
      },
    });

    await prisma.auditoria.create({
      data: {
        actorId: BigInt(medico.usuarioId),
        accion: "Incorporar corrección a consulta",
        entidad: "correccion",
        referenciaId: idObjetivo,
      },
    });
  } catch (error) {
    console.error("Error al agregar corrección:", error);
    return {
      success: false,
      message: "Ocurrió un error interno al intentar guardar la corrección.",
    };
  }

  revalidatePath(`/medico/turnos/${turnoId}`);

  return {
    success: true,
    message: "La corrección se guardó y anexó correctamente a la consulta.",
  };
}

/**
 * Obtiene el historial de consultas de un médico.
 * @param medicoUsuarioId
 * @returns
 * @todo Implementar paginación y filtros de búsqueda para mejorar la eficiencia y usabilidad.
 */
export async function obtenerResumenConsultasMedico(medicoUsuarioId: string) {
  const consultas = await prisma.consulta.findMany({
    where: {
      autorId: BigInt(medicoUsuarioId),
    },
    orderBy: {
      creadaEn: "desc",
    },
    select: {
      turnoId: true,
      creadaEn: true,
      turno: {
        select: {
          paciente: {
            select: {
              dni: true,
              persona: { select: { nombreCompleto: true } },
            },
          },
        },
      },
    },
    take: 50,
  });

  return consultas.map((c) => ({
    turnoId: c.turnoId.toString(),
    creadaEn: c.creadaEn.toISOString(),
    pacienteNombre: c.turno.paciente.persona.nombreCompleto,
    pacienteDni: c.turno.paciente.dni,
  }));
}
