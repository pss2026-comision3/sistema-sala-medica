"use client";

import { useTransition, useState } from "react";
import type { AvisoInternoViewData } from "@/lib/notificaciones/avisos";
import { marcarTodosLeidosAction } from "@/app/actions/avisos";
import { AvisoItem } from "./aviso-item";

const ITEMS_POR_PAGINA = 5;

type Props = {
  avisos: AvisoInternoViewData[];
  rol: string;
  titulo?: string;
  descripcion?: string;
};

export function BandejaAvisos({
  avisos: inicial,
  rol,
  titulo = "Avisos",
  descripcion = "Confirmaciones, cambios y recordatorios reunidos en un solo lugar.",
}: Props) {
  const [lista, setLista] = useState(inicial);
  const [orden, setOrden] = useState<"reciente" | "antiguo">("reciente");
  const [pagina, setPagina] = useState(1);
  const [isPending, startTransition] = useTransition();

  const hayNoLeidos = lista.some((a) => !a.leido);
  const totalNoLeidos = lista.filter((a) => !a.leido).length;

  function onLeer(id: string) {
    setLista((prev) =>
      prev.map((a) => (a.id === id ? { ...a, leido: true } : a)),
    );
  }

  function onMarcarTodos() {
    startTransition(async () => {
      await marcarTodosLeidosAction();
      setLista((prev) => prev.map((a) => ({ ...a, leido: true })));
    });
  }

  // Ordenamiento: No leídos primero, leídos al fondo; luego según fecha (reciente/antiguo)
  const avisosOrdenados = [...lista].sort((a, b) => {
    // 1. Los no leídos van primero, los leídos van al fondo
    if (a.leido !== b.leido) {
      return a.leido ? 1 : -1;
    }

    // 2. Dentro del mismo estado (ambos no leídos o ambos leídos), ordenar por fecha
    const timeA = new Date(a.creadoEn).getTime();
    const timeB = new Date(b.creadoEn).getTime();
    return orden === "reciente" ? timeB - timeA : timeA - timeB;
  });

  // Paginación
  const totalPaginas = Math.ceil(avisosOrdenados.length / ITEMS_POR_PAGINA);
  const paginaActual = Math.min(Math.max(1, pagina), totalPaginas || 1);
  const inicioIndice = (paginaActual - 1) * ITEMS_POR_PAGINA;
  const avisosPaginados = avisosOrdenados.slice(
    inicioIndice,
    inicioIndice + ITEMS_POR_PAGINA,
  );

  return (
    <div>
      {/* Cabecera estilo SIGSAM con botón "Marcar todo como leído" a la derecha */}
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1
            style={{ fontSize: "28px", fontWeight: 800, margin: "2px 0 6px" }}
          >
            {titulo}
          </h1>
          <p style={{ margin: 0 }}>{descripcion}</p>
        </div>

        {hayNoLeidos && (
          <div>
            <button
              type="button"
              className="sigsam-btn secondary"
              onClick={onMarcarTodos}
              disabled={isPending}
              style={{
                borderRadius: "8px",
                borderColor: "#a9c9cb",
                padding: "8px 16px",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              {isPending ? "Marcando…" : "Marcar todo como leído"}
            </button>
          </div>
        )}
      </div>

      {lista.length === 0 ? (
        <section
          className="sigsam-card"
          style={{ padding: "32px", textAlign: "center" }}
        >
          <p
            style={{ margin: 0, color: "var(--color-muted)", fontSize: "15px" }}
          >
            No tenés avisos por el momento.
          </p>
        </section>
      ) : (
        <>
          {/* Barra de herramientas: total y selector de ordenamiento */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ fontSize: "14px", color: "var(--color-muted)" }}>
              {lista.length} {lista.length === 1 ? "aviso" : "avisos"}{" "}
              {totalNoLeidos > 0 && (
                <span style={{ fontWeight: 600, color: "var(--color-brand)" }}>
                  ({totalNoLeidos} sin leer)
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <label
                htmlFor="orden-selector"
                style={{ fontSize: "14px", color: "var(--color-muted)" }}
              >
                Ordenar por:
              </label>
              <select
                id="orden-selector"
                value={orden}
                onChange={(e) => {
                  setOrden(e.target.value as "reciente" | "antiguo");
                  setPagina(1);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--color-line, #adc2c6)",
                  backgroundColor: "#ffffff",
                  fontSize: "14px",
                  color: "var(--color-ink)",
                  cursor: "pointer",
                }}
              >
                <option value="reciente">Más reciente</option>
                <option value="antiguo">Más antiguo</option>
              </select>
            </div>
          </div>

          {/* Listado de tarjetas de aviso */}
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {avisosPaginados.map((a) => (
              <AvisoItem key={a.id} aviso={a} rol={rol} onLeer={onLeer} />
            ))}
          </ul>

          {/* Controles de paginación (cada 5 items) */}
          {totalPaginas > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "24px",
                paddingTop: "16px",
                borderTop: "1px solid var(--color-line, #dbe4e6)",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div style={{ fontSize: "13px", color: "var(--color-muted)" }}>
                Mostrando {inicioIndice + 1} a{" "}
                {Math.min(
                  inicioIndice + ITEMS_POR_PAGINA,
                  avisosOrdenados.length,
                )}{" "}
                de {avisosOrdenados.length} avisos
              </div>

              <div
                style={{ display: "flex", gap: "6px", alignItems: "center" }}
              >
                <button
                  type="button"
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  disabled={paginaActual === 1}
                  className="sigsam-btn-ghost"
                  style={{
                    padding: "6px 12px",
                    fontSize: "13px",
                    opacity: paginaActual === 1 ? 0.5 : 1,
                    cursor: paginaActual === 1 ? "not-allowed" : "pointer",
                  }}
                >
                  ← Anterior
                </button>

                {Array.from({ length: totalPaginas }, (_, i) => i + 1).map(
                  (num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPagina(num)}
                      className={
                        num === paginaActual
                          ? "sigsam-btn secondary small"
                          : "sigsam-btn-ghost"
                      }
                      style={{
                        minWidth: "34px",
                        height: "34px",
                        padding: "0 8px",
                        fontSize: "13px",
                        fontWeight: num === paginaActual ? 700 : 500,
                      }}
                    >
                      {num}
                    </button>
                  ),
                )}

                <button
                  type="button"
                  onClick={() =>
                    setPagina((p) => Math.min(totalPaginas, p + 1))
                  }
                  disabled={paginaActual === totalPaginas}
                  className="sigsam-btn-ghost"
                  style={{
                    padding: "6px 12px",
                    fontSize: "13px",
                    opacity: paginaActual === totalPaginas ? 0.5 : 1,
                    cursor:
                      paginaActual === totalPaginas ? "not-allowed" : "pointer",
                  }}
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
