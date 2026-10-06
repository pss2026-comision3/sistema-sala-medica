"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ETIQUETA_ROL, INICIO_POR_ROL } from "@/lib/auth/constants";
import type { SesionActual } from "@/lib/auth/session";
import { LogoutButton } from "@/components/logout-button";

type NavItem = { href: string; label: string };

const NAV_POR_ROL: Record<SesionActual["rol"], NavItem[]> = {
  ADMIN: [
    { href: "/admin", label: "Inicio" },
    { href: "/admin/pacientes", label: "Pacientes" },
    { href: "/admin/agenda", label: "Agenda" },
    { href: "/admin/parametros", label: "Parámetros" },
  ],
  MEDICO: [
    { href: "/medico", label: "Agenda" },
    { href: "/medico/disponibilidad", label: "Disponibilidad" },
  ],
  ENFERMERIA: [{ href: "/enfermeria", label: "Inicio" }],
  PACIENTE: [
    { href: "/paciente", label: "Inicio" },
    { href: "/paciente/buscar", label: "Buscar turno" },
    { href: "/paciente/confirmar", label: "Confirmar cita" },
    { href: "/paciente/turnos", label: "Mis turnos" },
  ],
};

const NOMBRE_ROL: Record<SesionActual["rol"], string> = {
  ADMIN: "Administración",
  MEDICO: "Médico",
  ENFERMERIA: "Enfermería",
  PACIENTE: "Paciente",
};

type Props = {
  sesion: SesionActual;
  children: ReactNode;
};

export function AppShell({ sesion, children }: Props) {
  const pathname = usePathname();
  const items = NAV_POR_ROL[sesion.rol];
  const inicio = INICIO_POR_ROL[sesion.rol];
  const etiquetaRol = NOMBRE_ROL[sesion.rol];
  const tituloActual =
    items
      .filter(
        (it) =>
          pathname === it.href ||
          (it.href !== inicio && pathname.startsWith(it.href)),
      )
      .sort((a, b) => b.href.length - a.href.length)[0]?.label ?? etiquetaRol;

  return (
    <div className="sigsam-app-shell">
      <Link href={inicio} className="sigsam-brand" aria-label="SIGSAM">
        <span className="sigsam-brand-mark" aria-hidden="true">
          +
        </span>
        SIGSAM
      </Link>
      <nav className="sigsam-nav" aria-label="Navegación principal">
        <div className="sigsam-nav-label">{etiquetaRol}</div>
        <div className="sigsam-nav-links">
          {items.map((it) => {
            const activo =
              pathname === it.href ||
              (it.href !== inicio && pathname.startsWith(it.href));
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={activo ? "page" : undefined}
              >
                <span className="sigsam-nav-dot" aria-hidden="true" />
                {it.label}
              </Link>
            );
          })}
        </div>
        <div className="sigsam-nav-foot">
          <strong>{sesion.nombre}</strong>
          Datos de demostración · Argentina
        </div>
      </nav>
      <header className="sigsam-topbar">
        <span className="crumb">
          {etiquetaRol} / {tituloActual}
        </span>
        <div className="sigsam-topbar-user">
          <div className="sigsam-topbar-user-info">
            <span className="user-name">{sesion.nombre}</span>
            <span className="user-role">{ETIQUETA_ROL[sesion.rol]}</span>
          </div>
          <Link
            href="/cuenta/clave"
            className="sigsam-btn-ghost"
            title="Cambiar mi contraseña"
          >
            Cambiar clave
          </Link>
          <LogoutButton />
        </div>
      </header>
      <main className="sigsam-content">{children}</main>
    </div>
  );
}
