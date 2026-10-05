"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/db/prisma";
import { AUDITORIA, INICIO_POR_ROL, MSG } from "@/lib/auth/constants";
import {
  destinoPostLogin,
  requireRole,
  requireSession,
} from "@/lib/auth/guards";
import {
  generarClaveTemporal,
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
  exito?: boolean;
  campos?: {
    email?: string;
    password?: string;
    actual?: string;
    temporal?: string;
    nueva?: string;
    confirmacion?: string;
  };
};

export type ResultadoRestablecimiento = {
  error?: string;
  exito?: boolean;
  credenciales?: {
    nombre: string;
    email: string;
    claveTemporal: string;
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

export async function restablecerClavePorAdmin(
  usuarioId: string,
): Promise<ResultadoRestablecimiento> {
  const sesionAdmin = await requireRole("ADMIN");

  const usuario = await prisma.usuario.findUnique({
    where: { id: BigInt(usuarioId) },
    include: { persona: true },
  });

  if (!usuario || !usuario.activo) {
    return { error: MSG.SOLO_CUENTAS_ACTIVAS };
  }

  const claveTemporal = generarClaveTemporal();
  const passwordHash = await hashearPassword(claveTemporal);

  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id: usuario.id },
      data: {
        passwordHash,
        claveTemporal: true,
      },
    });

    await tx.sesion.updateMany({
      where: {
        usuarioId: usuario.id,
        finalizadaEn: null,
      },
      data: {
        finalizadaEn: new Date(),
      },
    });

    await tx.auditoria.create({
      data: {
        actorId: BigInt(sesionAdmin.usuarioId),
        accion: AUDITORIA.RESTABLECIMIENTO_ADMIN,
        entidad: "usuario",
        referenciaId: usuario.id,
        detalle: null,
      },
    });
  });

  return {
    exito: true,
    credenciales: {
      nombre: usuario.persona.nombreCompleto,
      email: usuario.email,
      claveTemporal,
    },
  };
}

export async function cambiarPasswordVoluntario(
  _prev: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const sesion = await requireSession();
  if (sesion.claveTemporal) {
    redirect("/cambiar-clave");
  }

  const actual = String(formData.get("actual") ?? "");
  const nueva = String(formData.get("nueva") ?? "");
  const confirmacion = String(formData.get("confirmacion") ?? "");

  if (!actual) {
    return {
      error: MSG.PASSWORD_ACTUAL_REQUERIDO,
      campos: { actual, nueva, confirmacion },
    };
  }

  if (!nueva) {
    return {
      error: MSG.NUEVA_REQUERIDA,
      campos: { actual, nueva, confirmacion },
    };
  }

  if (nueva.length < 8) {
    return {
      error: MSG.NUEVA_CORTA,
      campos: { actual, nueva, confirmacion },
    };
  }

  if (nueva !== confirmacion) {
    return {
      error: MSG.REPETICION_NO_COINCIDE,
      campos: { actual, nueva, confirmacion },
    };
  }

  if (nueva === actual) {
    return {
      error: MSG.IGUAL_A_ACTUAL,
      campos: { actual, nueva, confirmacion },
    };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: BigInt(sesion.usuarioId) },
  });

  if (!usuario || !usuario.activo) {
    await cerrarSesionActual();
    redirect("/login");
  }

  const actualOk = await verificarPassword(actual, usuario.passwordHash);
  if (!actualOk) {
    return {
      error: MSG.PASSWORD_ACTUAL_INCORRECTO,
      campos: { actual, nueva, confirmacion },
    };
  }

  const mismaQueActual = await verificarPassword(nueva, usuario.passwordHash);
  if (mismaQueActual) {
    return {
      error: MSG.IGUAL_A_ACTUAL,
      campos: { actual, nueva, confirmacion },
    };
  }

  const nuevoHash = await hashearPassword(nueva);

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      passwordHash: nuevoHash,
    },
  });

  await registrarAuditoria({
    actorId: usuario.id,
    accion: AUDITORIA.CAMBIO_VOLUNTARIO,
    referenciaId: usuario.id,
  });

  return {
    exito: true,
  };
}
