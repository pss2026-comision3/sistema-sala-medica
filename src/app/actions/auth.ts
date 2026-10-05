"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/db/prisma";
import { AUDITORIA, INICIO_POR_ROL, MSG } from "@/lib/auth/constants";
import { destinoPostLogin } from "@/lib/auth/guards";
import {
  HASH_DUMMY,
  hashearPassword,
  normalizarEmail,
  verificarPassword,
} from "@/lib/auth/password";
import {
  cerrarSesionActual,
  crearSesion,
  getSession,
} from "@/lib/auth/session";
import { registrarAuditoria } from "@/lib/auth/audit";

export type EstadoFormulario = {
  error?: string;
  campos?: {
    email?: string;
    password?: string;
    temporal?: string;
    nueva?: string;
    confirmacion?: string;
  };
};

export async function login(
  _prev: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const emailInput = String(formData.get("email") ?? "");
  const passwordInput = String(formData.get("password") ?? "");
  const email = normalizarEmail(emailInput);

  if (!email) {
    return {
      error: MSG.EMAIL_REQUERIDO,
      campos: { email: emailInput, password: passwordInput },
    };
  }
  if (!passwordInput) {
    return {
      error: MSG.PASSWORD_REQUERIDO,
      campos: { email: emailInput },
    };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: { persona: true },
  });

  if (!usuario) {
    await verificarPassword(passwordInput, HASH_DUMMY);
    return {
      error: MSG.CREDENCIALES_INVALIDAS,
      campos: { email: emailInput },
    };
  }

  const coincide = await verificarPassword(passwordInput, usuario.passwordHash);
  if (!coincide) {
    return {
      error: MSG.CREDENCIALES_INVALIDAS,
      campos: { email: emailInput },
    };
  }

  if (!usuario.activo) {
    return { error: MSG.CUENTA_DESACTIVADA };
  }

  const usuarioId = usuario.id;
  await crearSesion(usuarioId);
  await registrarAuditoria({
    actorId: usuarioId,
    accion: AUDITORIA.INICIO,
    referenciaId: usuarioId,
  });

  const destino = usuario.claveTemporal
    ? "/cambiar-clave"
    : INICIO_POR_ROL[usuario.rol];
  redirect(destino);
}

export async function recuperarClave(
  _prev: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const emailInput = String(formData.get("email") ?? "");
  const temporal = String(formData.get("temporal") ?? "");
  const nueva = String(formData.get("nueva") ?? "");
  const confirmacion = String(formData.get("confirmacion") ?? "");
  const email = normalizarEmail(emailInput);

  if (!email || !temporal || !nueva || !confirmacion) {
    return { error: MSG.CAMPOS_RECUPERAR, campos: { email: emailInput } };
  }

  if (nueva.length < 8) {
    return { error: MSG.NUEVA_CORTA, campos: { email: emailInput } };
  }

  if (nueva !== confirmacion) {
    return { error: MSG.REPETICION_NO_COINCIDE, campos: { email: emailInput } };
  }

  if (nueva === temporal) {
    return { error: MSG.IGUAL_A_TEMPORAL, campos: { email: emailInput } };
  }

  const usuario = await prisma.usuario.findUnique({ where: { email } });

  const temporalOk = await verificarPassword(
    temporal,
    usuario?.passwordHash ?? HASH_DUMMY,
  );

  if (!usuario || !usuario.activo || !usuario.claveTemporal || !temporalOk) {
    return { error: MSG.RECUPERACION_INVALIDA, campos: { email: emailInput } };
  }

  const mismaQueActual = await verificarPassword(nueva, usuario.passwordHash);
  if (mismaQueActual) {
    return { error: MSG.IGUAL_A_TEMPORAL, campos: { email: emailInput } };
  }

  const nuevoHash = await hashearPassword(nueva);

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { passwordHash: nuevoHash, claveTemporal: false },
  });

  await registrarAuditoria({
    actorId: usuario.id,
    accion: AUDITORIA.CAMBIO_TEMPORAL,
    referenciaId: usuario.id,
  });

  redirect("/login?recuperado=1");
}

export async function logout(): Promise<void> {
  const sesionCerrada = await cerrarSesionActual();
  if (sesionCerrada) {
    await registrarAuditoria({
      actorId: BigInt(sesionCerrada.usuarioId),
      accion: AUDITORIA.CIERRE,
      referenciaId: BigInt(sesionCerrada.usuarioId),
    });
  }
  redirect("/login");
}

export async function cambiarClave(
  _prev: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const sesion = await getSession();
  if (!sesion) redirect("/login");
  if (!sesion.claveTemporal) redirect(INICIO_POR_ROL[sesion.rol]);

  const temporal = String(formData.get("temporal") ?? "");
  const nueva = String(formData.get("nueva") ?? "");
  const confirmacion = String(formData.get("confirmacion") ?? "");

  if (!temporal) {
    return {
      error: MSG.TEMPORAL_REQUERIDA,
      campos: { nueva, confirmacion },
    };
  }

  if (nueva.length < 8) {
    return {
      error: MSG.NUEVA_CORTA,
      campos: { temporal, nueva, confirmacion },
    };
  }

  if (nueva !== confirmacion) {
    return {
      error: MSG.REPETICION_NO_COINCIDE,
      campos: { temporal, nueva },
    };
  }

  if (nueva === temporal) {
    return {
      error: MSG.IGUAL_A_TEMPORAL,
      campos: { temporal, nueva, confirmacion },
    };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: BigInt(sesion.usuarioId) },
  });

  if (!usuario || !usuario.activo) {
    await cerrarSesionActual();
    redirect("/login");
  }

  const temporalOk = await verificarPassword(temporal, usuario.passwordHash);
  if (!temporalOk) {
    return {
      error: MSG.TEMPORAL_INCORRECTA,
      campos: { nueva, confirmacion },
    };
  }

  const mismaQueActual = await verificarPassword(nueva, usuario.passwordHash);
  if (mismaQueActual) {
    return {
      error: MSG.IGUAL_A_TEMPORAL,
      campos: { temporal, nueva, confirmacion },
    };
  }

  const nuevoHash = await hashearPassword(nueva);

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      passwordHash: nuevoHash,
      claveTemporal: false,
    },
  });

  await registrarAuditoria({
    actorId: usuario.id,
    accion: AUDITORIA.CAMBIO_TEMPORAL,
    referenciaId: usuario.id,
  });

  const sesionActualizada = await getSession();
  redirect(destinoPostLogin(sesionActualizada ?? sesion));
}
