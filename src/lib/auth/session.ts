import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";

import { Prisma, type Rol } from "@/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  COOKIE_SESION,
  COOKIE_MAX_AGE_SEG,
  INACTIVIDAD_MS,
  TOQUE_MS,
} from "@/lib/auth/constants";

export type SesionActual = {
  sesionId: string;
  usuarioId: string;
  email: string;
  nombre: string;
  rol: Rol;
  claveTemporal: boolean;
};

type SesionConUsuario = Prisma.SesionGetPayload<{
  include: { usuario: { include: { persona: true } } };
}>;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function setCookieSesion(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_SESION, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SEG,
  });
}

async function eliminarCookieSesion(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_SESION);
}

export async function crearSesion(usuarioId: bigint): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const ahora = new Date();
  await prisma.sesion.create({
    data: {
      usuarioId,
      tokenHash: hashToken(token),
      creadaEn: ahora,
      ultimaActividad: ahora,
    },
  });
  await setCookieSesion(token);
}

async function cargarSesionPorToken(
  tokenCookie: string,
): Promise<SesionConUsuario | null> {
  return prisma.sesion.findUnique({
    where: { tokenHash: hashToken(tokenCookie) },
    include: {
      usuario: { include: { persona: true } },
    },
  });
}

async function finalizarSesion(sesionId: bigint): Promise<void> {
  await prisma.sesion.update({
    where: { id: sesionId },
    data: { finalizadaEn: new Date() },
  });
}

export async function cerrarSesionActual(): Promise<SesionActual | null> {
  const jar = await cookies();
  const tokenCookie = jar.get(COOKIE_SESION)?.value;
  if (!tokenCookie) return null;

  const sesion = await cargarSesionPorToken(tokenCookie);
  await eliminarCookieSesion();

  if (!sesion) return null;
  if (sesion.finalizadaEn === null) {
    await finalizarSesion(sesion.id);
  }

  return {
    sesionId: sesion.id.toString(),
    usuarioId: sesion.usuario.id.toString(),
    email: sesion.usuario.email,
    nombre: sesion.usuario.persona.nombreCompleto,
    rol: sesion.usuario.rol,
    claveTemporal: sesion.usuario.claveTemporal,
  };
}

export async function getSession(): Promise<SesionActual | null> {
  const jar = await cookies();
  const tokenCookie = jar.get(COOKIE_SESION)?.value;
  if (!tokenCookie) return null;

  const sesion = await cargarSesionPorToken(tokenCookie);
  if (!sesion) return null;
  if (sesion.finalizadaEn !== null) return null;

  if (!sesion.usuario.activo) {
    await finalizarSesion(sesion.id);
    return null;
  }

  const inactivoMs = Date.now() - sesion.ultimaActividad.getTime();
  if (inactivoMs > INACTIVIDAD_MS) {
    await finalizarSesion(sesion.id);
    return null;
  }

  if (inactivoMs >= TOQUE_MS) {
    await prisma.sesion.update({
      where: { id: sesion.id },
      data: { ultimaActividad: new Date() },
    });
  }

  return {
    sesionId: sesion.id.toString(),
    usuarioId: sesion.usuario.id.toString(),
    email: sesion.usuario.email,
    nombre: sesion.usuario.persona.nombreCompleto,
    rol: sesion.usuario.rol,
    claveTemporal: sesion.usuario.claveTemporal,
  };
}
