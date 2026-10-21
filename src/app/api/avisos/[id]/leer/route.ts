import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const sesion = await getSession();
  if (!sesion) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: rawId } = await params;
  let id: bigint;
  try {
    id = BigInt(rawId);
  } catch {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  // CA2: verificar que el aviso pertenece al usuario de la sesión
  const aviso = await prisma.avisoInterno.findFirst({
    where: { id, usuarioId: BigInt(sesion.usuarioId) },
  });
  if (!aviso) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  await prisma.avisoInterno.update({ where: { id }, data: { leido: true } });
  return NextResponse.json({ ok: true });
}
