import { NextResponse } from "next/server";
import path from "node:path";
import { promises as fs } from "node:fs";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  extensionPorMime,
  esMimeAdjuntoPermitido,
} from "@/lib/turnos/adjuntos-clinicos";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ turnoId: string; adjuntoId: string }> },
) {
  const sesion = await getSession();
  if (!sesion || sesion.rol !== "MEDICO") {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const { turnoId: turnoIdRaw, adjuntoId: adjuntoIdRaw } = await params;

  let turnoId: bigint;
  let adjuntoId: bigint;
  try {
    turnoId = BigInt(turnoIdRaw);
    adjuntoId = BigInt(adjuntoIdRaw);
  } catch {
    return new NextResponse("No encontrado", { status: 404 });
  }

  const adjunto = await prisma.adjunto.findUnique({
    where: { id: adjuntoId },
    include: {
      consulta: {
        include: {
          turno: {
            include: {
              disponibilidad: true,
            },
          },
        },
      },
    },
  });

  if (!adjunto || adjunto.consulta.turnoId !== turnoId) {
    return new NextResponse("No encontrado", { status: 404 });
  }

  // CA5: solo el médico autor de la consulta (y titular de la cita) accede.
  if (
    adjunto.consulta.autorId.toString() !== sesion.usuarioId ||
    adjunto.consulta.turno.disponibilidad.profesionalId.toString() !==
      sesion.usuarioId
  ) {
    return new NextResponse("No encontrado", { status: 404 });
  }

  const archivo = adjunto.rutaPrivada;
  const abs = path.isAbsolute(archivo)
    ? archivo
    : path.join(process.cwd(), archivo);

  let contenido: Buffer<ArrayBuffer>;
  try {
    contenido = await fs.readFile(abs);
  } catch (error) {
    console.error(error);
    return new NextResponse("Sin archivo", { status: 409 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";

  const mime = adjunto.mimeType;
  const ext = esMimeAdjuntoPermitido(mime)
    ? extensionPorMime(mime)
    : path.extname(abs).toLowerCase() || "";
  const nombreSeguro = adjunto.nombre
    .replace(/[\r\n"]/g, "")
    .trim()
    .slice(0, 200);
  const filename = `${nombreSeguro || "adjunto"}${ext}`;

  return new NextResponse(contenido, {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": download
        ? `attachment; filename="${filename}"`
        : `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
