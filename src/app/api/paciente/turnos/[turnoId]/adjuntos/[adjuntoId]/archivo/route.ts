import { NextResponse } from "next/server";
import path from "node:path";
import { promises as fs } from "node:fs";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { cargarBeneficiarios } from "@/lib/turnos/buscar-horarios";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ turnoId: string; adjuntoId: string }> },
) {
  const sesion = await getSession();
  if (!sesion || sesion.rol !== "PACIENTE") {
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

  const beneficiarios = await cargarBeneficiarios(BigInt(sesion.usuarioId));
  const beneficiarioIds = new Set(beneficiarios.map((b) => b.id));

  const turno = await prisma.turno.findUnique({
    where: { id: turnoId },
    select: {
      pacienteId: true,
      consulta: {
        select: {
          adjuntos: {
            where: { id: adjuntoId },
            select: {
              id: true,
              rutaPrivada: true,
              mimeType: true,
            },
          },
        },
      },
    },
  });

  if (!turno || !beneficiarioIds.has(turno.pacienteId.toString())) {
    return new NextResponse("No encontrado", { status: 404 });
  }

  const adjunto = turno.consulta?.adjuntos?.[0];
  if (!adjunto) {
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

  // CA4: solo visualización en línea; sin descarga clínica desde el portal.
  return new NextResponse(contenido, {
    headers: {
      "Content-Type": adjunto.mimeType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  });
}
