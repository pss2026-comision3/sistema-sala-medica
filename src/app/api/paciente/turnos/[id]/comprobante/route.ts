import { NextResponse } from "next/server";
import path from "node:path";
import { promises as fs } from "node:fs";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { cargarBeneficiarios } from "@/lib/turnos/buscar-horarios";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await getSession();
  if (!sesion || sesion.rol !== "PACIENTE") {
    return new NextResponse("No autorizado", { status: 401 });
  }

  let turnoId: bigint;
  try {
    turnoId = BigInt((await params).id);
  } catch {
    return new NextResponse("No encontrado", { status: 404 });
  }

  const ahora = new Date();
  const beneficiarios = await cargarBeneficiarios(
    BigInt(sesion.usuarioId),
    ahora,
  );
  const turno = await prisma.turno.findUnique({
    where: { id: turnoId },
    select: {
      id: true,
      pacienteId: true,
      comprobantes: { take: 1, orderBy: { id: "asc" } },
    },
  });
  if (!turno) {
    return new NextResponse("No encontrado", { status: 404 });
  }
  const pertenece = beneficiarios.some(
    (b) => b.id === turno.pacienteId.toString(),
  );
  if (!pertenece) {
    return new NextResponse("No encontrado", { status: 404 });
  }
  const comprobante = turno.comprobantes[0];
  if (!comprobante) {
    return new NextResponse("Sin comprobante", { status: 404 });
  }
  const archivo = comprobante.archivoPrivado;
  if (!archivo) {
    return new NextResponse("Sin archivo", { status: 409 });
  }
  try {
    const abs = path.isAbsolute(archivo)
      ? archivo
      : path.join(process.cwd(), archivo);
    const contenido = await fs.readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    const tipo =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".png"
          ? "image/png"
          : ext === ".jpg" || ext === ".jpeg"
            ? "image/jpeg"
            : "application/octet-stream";
    return new NextResponse(contenido, {
      headers: {
        "Content-Type": tipo,
        "Content-Disposition": `attachment; filename="comprobante-${turno.id}${ext || ".pdf"}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error(e);
    return new NextResponse("Sin archivo", { status: 409 });
  }
}
