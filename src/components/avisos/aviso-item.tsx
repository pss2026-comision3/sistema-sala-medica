"use client";

import { useTransition } from "react";
import Link from "next/link";
import type { AvisoInternoViewData } from "@/lib/notificaciones/avisos";
import { marcarAvisoLeidoAction } from "@/app/actions/avisos";

type Props = {
  aviso: AvisoInternoViewData;
  rol: string;
  onLeerAction?: (id: string) => void;
};

export function AvisoItem({ aviso, rol, onLeerAction }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleMarcar() {
    startTransition(async () => {
      await marcarAvisoLeidoAction(aviso.id);
      onLeerAction?.(aviso.id);
    });
  }

  const rutaRol = rol.toLowerCase();
  const fecha = new Date(aviso.creadoEn);
  const fechaFormateada = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(fecha);
  const horaFormateada = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(fecha);

  const metaSubtitulo = aviso.turnoId
    ? `${fechaFormateada} · Correo: Enviado`
    : `${fechaFormateada} · ${horaFormateada} hs`;

  return (
    <li
      style={{
        backgroundColor: aviso.leido ? "#ffffff" : "#f7fcfc",
        border: aviso.leido ? "1px solid #e2e8f0" : "1px solid #b2dfdb",
        borderLeft: aviso.leido
          ? "1px solid #e2e8f0"
          : "4px solid var(--color-brand, #006666)",
        borderRadius: "12px",
        padding: "18px 22px",
        marginBottom: "14px",
        boxShadow: aviso.leido
          ? "0 1px 2px rgba(0, 0, 0, 0.03)"
          : "0 2px 6px rgba(0, 102, 102, 0.08)",
        transition: "all 0.2s ease-in-out",
      }}
    >
      {/* Fila 1: Título del evento + Pill Leído / No leído */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: "16px",
            fontWeight: 700,
            color: aviso.leido ? "#334155" : "#0f172a",
          }}
        >
          {aviso.evento}
        </span>

        {/* Pill con punto indicador de estado */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "2px 10px",
            borderRadius: "9999px",
            fontSize: "12px",
            fontWeight: 600,
            backgroundColor: aviso.leido ? "#f1f5f9" : "#e0f2f1",
            color: aviso.leido ? "#64748b" : "#00695c",
          }}
        >
          <span
            style={{
              fontSize: "10px",
              lineHeight: 1,
              color: aviso.leido ? "#94a3b8" : "#00897b",
            }}
          >
            ●
          </span>
          {aviso.leido ? "Leído" : "No leído"}
        </span>
      </div>

      {/* Fila 2: Subtítulo (Fecha · Correo) */}
      <div
        style={{
          fontSize: "13px",
          color: "var(--color-muted, #64748b)",
          marginTop: "4px",
        }}
      >
        {metaSubtitulo}
      </div>

      {/* Fila 3: Cuerpo del aviso */}
      <p
        style={{
          margin: "10px 0 14px",
          fontSize: "14px",
          lineHeight: "1.5",
          color: aviso.leido ? "#475569" : "#1e293b",
        }}
      >
        {aviso.resumen}
      </p>

      {/* Fila 4: Acciones */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        {aviso.enlaceDisponible && aviso.turnoId && (
          <Link
            href={`/${rutaRol}/turnos/${aviso.turnoId}`}
            className="sigsam-btn secondary small"
            style={{ fontSize: "13px", minHeight: "34px", padding: "4px 12px" }}
          >
            Ver cita
          </Link>
        )}
        {!aviso.leido && (
          <button
            type="button"
            className="sigsam-btn-ghost"
            onClick={handleMarcar}
            disabled={isPending}
            style={{ fontSize: "13px", padding: "4px 8px" }}
          >
            {isPending ? "Marcando…" : "Marcar como leído"}
          </button>
        )}
      </div>
    </li>
  );
}
