"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { AUDITORIA, MSG } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import {
  esMimeAdjuntoPermitido,
  extensionPorMime,
  verificarFirmaMagica,
  validarArchivoAdjunto,
} from "@/lib/turnos/adjuntos-clinicos";

export type ResultadoAdjunto =
  | { exito: true; adjuntoId: string; mensaje: string }
  | { exito: false; error: string };

export async function adjuntarDocumentoConsultaAction(
  formData: FormData,
): Promise<ResultadoAdjunto> {
  // 1. Rol MEDICO y sesión activa.
  const sesion = await requireRole("MEDICO");
  const usuarioId = BigInt(sesion.usuarioId);

  // 2. Extraer y sanitizar datos.
  const turnoIdRaw = formData.get("turnoId")?.toString().trim() ?? "";
  const nombre = formData.get("nombre")?.toString().trim() ?? "";
  const archivo = formData.get("archivo");

  if (!turnoIdRaw) {
    return { exito: false, error: MSG.ADJUNTO_CONSULTA_NO_DISPONIBLE };
  }

  if (!nombre) {
    return { exito: false, error: MSG.ADJUNTO_NOMBRE_REQUERIDO };
  }
  if (nombre.length > 255) {
    return { exito: false, error: MSG.ADJUNTO_NOMBRE_LARGO };
  }

  if (!(archivo instanceof File)) {
    return { exito: false, error: MSG.ADJUNTO_ARCHIVO_REQUERIDO };
  }

  const validacion = validarArchivoAdjunto(archivo);
  if (!validacion.ok) {
    return { exito: false, error: validacion.error };
  }
  const { mime, size } = validacion;

  let turnoIdBig: bigint;
  try {
    turnoIdBig = BigInt(turnoIdRaw);
  } catch {
    return { exito: false, error: MSG.ADJUNTO_CONSULTA_NO_DISPONIBLE };
  }

  // 3. Verificar que la consulta exista y sea propia.
  const turno = await prisma.turno.findUnique({
    where: { id: turnoIdBig },
    include: {
      disponibilidad: true,
      consulta: true,
    },
  });

  if (!turno || !turno.consulta) {
    return { exito: false, error: MSG.ADJUNTO_CONSULTA_NO_DISPONIBLE };
  }
  if (turno.disponibilidad.profesionalId !== usuarioId) {
    return { exito: false, error: MSG.ADJUNTO_CONSULTA_NO_DISPONIBLE };
  }

  // 4. Leer el archivo y verificar firma mágica.
  let buffer: Buffer;
  try {
    buffer = Buffer.from(await archivo.arrayBuffer());
  } catch {
    return { exito: false, error: MSG.ADJUNTO_ERROR_GUARDADO };
  }

  if (!esMimeAdjuntoPermitido(mime) || !verificarFirmaMagica(buffer, mime)) {
    return { exito: false, error: MSG.ADJUNTO_ARCHIVO_CORRUPTO };
  }

  // 5. Persistir el archivo en el filesystem privado.
  const extension = extensionPorMime(mime);
  const relativePath = `storage/adjuntos/consulta/${turnoIdRaw}/${randomUUID()}${extension}`;
  const absolutePath = path.join(process.cwd(), relativePath);

  try {
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer);
  } catch (error) {
    console.error("Error al escribir adjunto de consulta:", error);
    return { exito: false, error: MSG.ADJUNTO_ERROR_GUARDADO };
  }

  // 6. Registrar la fila en la base y la auditoría en una transacción.
  try {
    const adjuntoCreado = await prisma.$transaction(async (tx) => {
      const creado = await tx.adjunto.create({
        data: {
          consultaTurnoId: turno.id,
          nombre,
          rutaPrivada: relativePath,
          mimeType: mime,
          tamanoBytes: BigInt(size),
          creadoEn: new Date(),
        },
      });

      await tx.auditoria.create({
        data: {
          actorId: usuarioId,
          accion: AUDITORIA.REGISTRO_ADJUNTO_CONSULTA,
          entidad: "adjunto",
          referenciaId: turno.id,
          detalle: JSON.stringify({
            turnoId: turno.id.toString(),
            adjuntoId: creado.id.toString(),
          }),
        },
      });

      return creado;
    });

    revalidatePath(`/medico/turnos/${turnoIdRaw}`);

    return {
      exito: true,
      adjuntoId: adjuntoCreado.id.toString(),
      mensaje: MSG.ADJUNTO_EXITO,
    };
  } catch (error) {
    console.error("Error al registrar adjunto de consulta:", error);
    // Limpiar el archivo si la persistencia en la base falló.
    try {
      await unlink(absolutePath);
    } catch {
      // Ignorar errores de limpieza para no enmascarar el error original.
    }
    return { exito: false, error: MSG.ADJUNTO_ERROR_GUARDADO };
  }
}
