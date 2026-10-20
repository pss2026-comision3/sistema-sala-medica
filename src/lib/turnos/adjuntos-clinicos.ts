import { prisma } from "@/lib/db/prisma";

import { MSG } from "@/lib/auth/constants";

export const ADJUNTO_MAX_BYTES = 10 * 1024 * 1024;

export const ADJUNTO_MIME_PERMITIDOS = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
} as const;

export type AdjuntoMime = keyof typeof ADJUNTO_MIME_PERMITIDOS;

export interface AdjuntoClinicoViewData {
  id: string;
  consultaTurnoId: string;
  nombre: string;
  mimeType: string;
  tamanoBytes: number;
  creadoEn: string; // ISO 8601
}

export function esMimeAdjuntoPermitido(mime: string): mime is AdjuntoMime {
  return Object.prototype.hasOwnProperty.call(ADJUNTO_MIME_PERMITIDOS, mime);
}

export function extensionPorMime(mime: AdjuntoMime): string {
  return ADJUNTO_MIME_PERMITIDOS[mime];
}

/**
 * Verifica la firma mágica del buffer contra el MIME declarado.
 * Evita que un archivo con extensión/MIME alterado se persista como válido.
 */
export function verificarFirmaMagica(
  buffer: Buffer,
  mime: AdjuntoMime,
): boolean {
  if (buffer.length === 0) return false;

  switch (mime) {
    case "application/pdf":
      // %PDF
      return (
        buffer.length >= 4 &&
        buffer[0] === 0x25 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x44 &&
        buffer[3] === 0x46
      );
    case "image/jpeg":
      // FF D8 FF
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );
    case "image/png":
      // 89 50 4E 47 0D 0A 1A 0A
      return (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );
    default:
      return false;
  }
}

export function validarArchivoAdjunto(
  file: File,
):
  { ok: true; mime: AdjuntoMime; size: number } | { ok: false; error: string } {
  if (!file || file.size === 0) {
    return { ok: false, error: MSG.ADJUNTO_ARCHIVO_REQUERIDO };
  }

  if (file.size > ADJUNTO_MAX_BYTES) {
    return { ok: false, error: MSG.ADJUNTO_TAMANO_EXCEDIDO };
  }

  const mime = file.type;
  if (!esMimeAdjuntoPermitido(mime)) {
    return { ok: false, error: MSG.ADJUNTO_TIPO_INVALIDO };
  }

  return { ok: true, mime, size: file.size };
}

export async function obtenerAdjuntosConsultaTurno({
  turnoId,
  medicoUsuarioId,
}: {
  turnoId: string;
  medicoUsuarioId: string;
}): Promise<AdjuntoClinicoViewData[] | null> {
  let turnoIdBig: bigint;
  try {
    turnoIdBig = BigInt(turnoId);
  } catch {
    return null;
  }

  const consulta = await prisma.consulta.findUnique({
    where: { turnoId: turnoIdBig },
    select: {
      turnoId: true,
      autorId: true,
      adjuntos: {
        orderBy: [{ creadoEn: "asc" }, { id: "asc" }],
        select: {
          id: true,
          consultaTurnoId: true,
          nombre: true,
          mimeType: true,
          tamanoBytes: true,
          creadoEn: true,
        },
      },
    },
  });

  if (!consulta) return null;

  // CA5: solo el médico autor accede a los adjuntos de su consulta.
  if (consulta.autorId.toString() !== medicoUsuarioId) {
    return null;
  }

  return consulta.adjuntos.map((adjunto) => ({
    id: adjunto.id.toString(),
    consultaTurnoId: adjunto.consultaTurnoId.toString(),
    nombre: adjunto.nombre,
    mimeType: adjunto.mimeType,
    tamanoBytes: Number(adjunto.tamanoBytes),
    creadoEn: adjunto.creadoEn.toISOString(),
  }));
}

export async function obtenerAdjuntosConsultaPaciente({
  turnoId,
  pacientePersonaId,
}: {
  turnoId: string;
  pacientePersonaId: string;
}): Promise<AdjuntoClinicoViewData[]> {
  let turnoIdBig: bigint;
  let pacienteIdBig: bigint;
  try {
    turnoIdBig = BigInt(turnoId);
    pacienteIdBig = BigInt(pacientePersonaId);
  } catch {
    return [];
  }

  const turno = await prisma.turno.findUnique({
    where: { id: turnoIdBig },
    select: {
      pacienteId: true,
      consulta: {
        select: {
          adjuntos: {
            orderBy: [{ creadoEn: "asc" }, { id: "asc" }],
            select: {
              id: true,
              consultaTurnoId: true,
              nombre: true,
              mimeType: true,
              tamanoBytes: true,
              creadoEn: true,
            },
          },
        },
      },
    },
  });

  if (!turno) return [];
  // CA4: solo el titular o un menor con tutoría vigente (validado por el caller)
  // puede consultar; aquí se verifica pertenencia al turno.
  if (turno.pacienteId !== pacienteIdBig) return [];
  if (!turno.consulta) return [];

  return turno.consulta.adjuntos.map((adjunto) => ({
    id: adjunto.id.toString(),
    consultaTurnoId: adjunto.consultaTurnoId.toString(),
    nombre: adjunto.nombre,
    mimeType: adjunto.mimeType,
    tamanoBytes: Number(adjunto.tamanoBytes),
    creadoEn: adjunto.creadoEn.toISOString(),
  }));
}
