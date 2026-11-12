"use client";
 
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";
 
import { registrarMovimientoInventario } from "@/app/actions/inventario";
import type { VacunaFormulario } from "@/lib/vacunacion/inventario";
import {
  CANTIDAD_MAXIMA,
  CODIGO_LOTE_MAX,
  ETIQUETA_TIPO_MOVIMIENTO,
  MOTIVO_CARGA_INICIAL,
  MSG_INVENTARIO,
  TEXTO_MAX,
  cantidadConSigno,
  evaluarMovimientoStock,
  type TipoMovimientoManual,
} from "@/lib/vacunacion/inventario-reglas";
 
type Props = {
  vacunas: VacunaFormulario[];
  /** Hoy en la sala (YYYY-MM-DD): el vencimiento de un lote nuevo es posterior. */
  hoy: string;
};
 
type ModoLote = "existente" | "nuevo";
 
function formatearFecha(iso: string): string {
  const [anio, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${anio}`;
}
 
function sumarUnDia(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
 
export function RegistrarMovimientoForm({ vacunas, hoy }: Props) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
 
  const [tipo, setTipo] = useState<TipoMovimientoManual>("COMPRA");
  const [vacunaId, setVacunaId] = useState(vacunas[0]?.id ?? "");
  const [modoLote, setModoLote] = useState<ModoLote>(
    vacunas[0]?.lotes.length ? "existente" : "nuevo",
  );
  const [loteId, setLoteId] = useState(vacunas[0]?.lotes[0]?.id ?? "");
  const [codigo, setCodigo] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [texto, setTexto] = useState("");
  const [corrige, setCorrige] = useState(false);
  const [corrigeId, setCorrigeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
 
  if (vacunas.length === 0) {
    return (
      <div className="sigsam-empty">
        <p>
          No hay vacunas activas. Creá o activá una vacuna desde la sección
          Vacunas para registrar movimientos.
        </p>
      </div>
    );
  }
 
  const vacuna = vacunas.find((v) => v.id === vacunaId) ?? vacunas[0];
  const lote = vacuna.lotes.find((l) => l.id === loteId);
  const corregibles =
    modoLote === "existente" && lote
      ? vacuna.corregibles.filter((m) => m.loteId === lote.id)
      : [];
  const cantidadNumero = Number(cantidad);
  const cantidadValida =
    cantidad.trim() !== "" &&
    Number.isInteger(cantidadNumero) &&
    cantidadNumero !== 0;
 
  // Vista previa de CA3 con los datos de la pantalla. La validación real la
  // repite el servidor con la vacuna bloqueada.
  const previa = cantidadValida
    ? evaluarMovimientoStock({
        codigoLote:
          modoLote === "nuevo"
            ? codigo.trim() || "nuevo"
            : (lote?.codigo ?? ""),
        saldoLote: modoLote === "nuevo" ? 0 : (lote?.saldo ?? 0),
        fisicoVacuna: vacuna.fisico,
        compromisos: vacuna.compromisos,
        cantidad: cantidadNumero,
      })
    : null;
 
  function limpiarAvisos() {
    setError(null);
    setMensaje(null);
  }
 
  function elegirVacuna(id: string) {
    const elegida = vacunas.find((v) => v.id === id);
    setVacunaId(id);
    setLoteId(elegida?.lotes[0]?.id ?? "");
    setModoLote(elegida?.lotes.length ? "existente" : "nuevo");
    setCorrige(false);
    setCorrigeId("");
  }
 
  function elegirTipo(nuevo: TipoMovimientoManual) {
    setTipo(nuevo);
    if (nuevo === "COMPRA") {
      setCorrige(false);
      setCorrigeId("");
    }
    limpiarAvisos();
  }
 
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    limpiarAvisos();
 
    if (!cantidadValida) {
      setError(
        tipo === "COMPRA"
          ? MSG_INVENTARIO.CANTIDAD_COMPRA
          : MSG_INVENTARIO.CANTIDAD_AJUSTE,
      );
      return;
    }
    if (corrige && !corrigeId) {
      setError(MSG_INVENTARIO.CORRECCION_NO_ENCONTRADA);
      return;
    }
 
    startTransition(async () => {
      const resultado = await registrarMovimientoInventario({
        tipo,
        vacunaId: vacuna.id,
        lote:
          modoLote === "existente"
            ? { modo: "existente", loteId }
            : { modo: "nuevo", codigo, fechaVencimiento: vencimiento },
        cantidad: cantidadNumero,
        texto,
        corrigeMovimientoId: tipo === "AJUSTE" && corrige ? corrigeId : null,
      });
 
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
 
      setMensaje(resultado.mensaje);
      setCantidad("");
      setTexto("");
      setCorrige(false);
      setCorrigeId("");
      if (modoLote === "nuevo") {
        setCodigo("");
        setVencimiento("");
      }
      router.refresh();
    });
  }
 
  const etiquetaTexto =
    tipo === "COMPRA" ? "Referencia de la compra" : "Motivo del ajuste";
 
  return (
    <form onSubmit={handleSubmit} noValidate>
      {mensaje && (
        <div className="sigsam-notice success" role="status" aria-live="polite">
          <span className="sigsam-notice-symbol" aria-hidden="true">
            <Check size={16} />
          </span>
          <div>
            <strong>Movimiento registrado</strong>
            <p>{mensaje}</p>
          </div>
        </div>
      )}
      {error && (
        <div className="sigsam-notice error" role="alert" aria-live="assertive">
          <span className="sigsam-notice-symbol" aria-hidden="true">
            !
          </span>
          <div>
            <strong>No se pudo registrar el movimiento</strong>
            <p>{error}</p>
          </div>
        </div>
      )}
 
      <div
        role="group"
        aria-label="Tipo de movimiento"
        style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}
      >
        {(["COMPRA", "AJUSTE"] as const).map((opcion) => (
          <button
            key={opcion}
            type="button"
            aria-pressed={tipo === opcion}
            className={`sigsam-btn small ${tipo === opcion ? "" : "secondary"}`}
            onClick={() => elegirTipo(opcion)}
          >
            {ETIQUETA_TIPO_MOVIMIENTO[opcion]}
          </button>
        ))}
      </div>
 
      <div className="sigsam-form-grid">
        <div className="sigsam-field">
          <label htmlFor="mov-vacuna">Vacuna *</label>
          <select
            id="mov-vacuna"
            value={vacuna.id}
            onChange={(e) => {
              elegirVacuna(e.target.value);
              limpiarAvisos();
            }}
          >
            {vacunas.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </select>
          <small className="hint">
            Físico: {vacuna.fisico} · Comprometidas: {vacuna.compromisos} ·
            Disponibles: {vacuna.fisico - vacuna.compromisos}
          </small>
        </div>
 
        <fieldset
          className="sigsam-field"
          style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
        >
          <legend
            style={{
              fontSize: 14,
              fontWeight: 800,
              marginBottom: 6,
              padding: 0,
            }}
          >
            Lote *
          </legend>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                fontWeight: 400,
              }}
            >
              <input
                type="radio"
                name="modo-lote"
                checked={modoLote === "existente"}
                disabled={vacuna.lotes.length === 0}
                onChange={() => {
                  setModoLote("existente");
                  setLoteId(vacuna.lotes[0]?.id ?? "");
                }}
                style={{ width: "auto", minHeight: 0 }}
              />
              Lote existente
            </label>
            <label
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                fontWeight: 400,
              }}
            >
              <input
                type="radio"
                name="modo-lote"
                checked={modoLote === "nuevo"}
                onChange={() => {
                  setModoLote("nuevo");
                  setCorrige(false);
                  setCorrigeId("");
                }}
                style={{ width: "auto", minHeight: 0 }}
              />
              Lote nuevo
            </label>
          </div>
          {vacuna.lotes.length === 0 && (
            <small className="hint">
              Esta vacuna todavía no tiene lotes: cargá uno nuevo.
            </small>
          )}
        </fieldset>
 
        {modoLote === "existente" ? (
          <div className="sigsam-field full">
            <label htmlFor="mov-lote">Lote existente *</label>
            <select
              id="mov-lote"
              value={loteId}
              onChange={(e) => {
                setLoteId(e.target.value);
                setCorrige(false);
                setCorrigeId("");
                limpiarAvisos();
              }}
            >
              {vacuna.lotes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.codigo} · vence {formatearFecha(l.fechaVencimiento)} ·{" "}
                  {l.saldo} dosis
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div className="sigsam-field">
              <label htmlFor="mov-codigo">Código de lote *</label>
              <input
                id="mov-codigo"
                type="text"
                autoComplete="off"
                maxLength={CODIGO_LOTE_MAX}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
              <small className="hint">Único en todo el inventario.</small>
            </div>
            <div className="sigsam-field">
              <label htmlFor="mov-vencimiento">Fecha de vencimiento *</label>
              <input
                id="mov-vencimiento"
                type="date"
                min={sumarUnDia(hoy)}
                value={vencimiento}
                onChange={(e) => setVencimiento(e.target.value)}
              />
            </div>
          </>
        )}
 
        <div className="sigsam-field">
          <label htmlFor="mov-cantidad">
            {tipo === "COMPRA" ? "Cantidad de dosis *" : "Variación de dosis *"}
          </label>
          <input
            id="mov-cantidad"
            type="number"
            step={1}
            min={
              tipo === "COMPRA" || modoLote === "nuevo" ? 1 : -CANTIDAD_MAXIMA
            }
            max={CANTIDAD_MAXIMA}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
          />
          <small className="hint">
            {tipo === "COMPRA"
              ? "Entero mayor a 0."
              : "Entero distinto de 0. Usá un valor negativo para una baja."}
          </small>
        </div>
 
        <div className="sigsam-field">
          <label htmlFor="mov-texto">{etiquetaTexto} *</label>
          <input
            id="mov-texto"
            type="text"
            autoComplete="off"
            maxLength={TEXTO_MAX}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={
              tipo === "COMPRA"
                ? "Remito, factura u orden de compra"
                : "Por ejemplo: rotura de frasco, conteo físico"
            }
          />
          {tipo === "AJUSTE" && modoLote === "nuevo" && (
            <small className="hint">
              ¿Es la carga inicial del lote?{" "}
              <button
                type="button"
                className="sigsam-link"
                style={{
                  border: 0,
                  background: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
                onClick={() => setTexto(MOTIVO_CARGA_INICIAL)}
              >
                Usar «{MOTIVO_CARGA_INICIAL}»
              </button>
            </small>
          )}
        </div>
 
        {tipo === "AJUSTE" && modoLote === "existente" && (
          <div className="sigsam-field full">
            <label
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                fontWeight: 400,
              }}
            >
              <input
                type="checkbox"
                checked={corrige}
                disabled={corregibles.length === 0}
                onChange={(e) => {
                  setCorrige(e.target.checked);
                  setCorrigeId(
                    e.target.checked ? (corregibles[0]?.id ?? "") : "",
                  );
                }}
                style={{ width: "auto", minHeight: 0 }}
              />
              Este ajuste corrige un movimiento anterior del lote
            </label>
            {corregibles.length === 0 && (
              <small className="hint">
                El lote no tiene compras ni ajustes para corregir.
              </small>
            )}
            {corrige && (
              <>
                <label htmlFor="mov-corrige" className="sr-only">
                  Movimiento a corregir
                </label>
                <select
                  id="mov-corrige"
                  value={corrigeId}
                  onChange={(e) => setCorrigeId(e.target.value)}
                >
                  {corregibles.map((m) => (
                    <option key={m.id} value={m.id}>
                      #{m.id} · {formatearFecha(m.creadoEn)} ·{" "}
                      {ETIQUETA_TIPO_MOVIMIENTO[m.tipo]} ·{" "}
                      {cantidadConSigno(m.cantidad)} dosis
                    </option>
                  ))}
                </select>
                <small className="hint">
                  El movimiento original no se modifica: los dos quedan en el
                  historial (por ejemplo, si se cargaron 20 en vez de 2,
                  registrá un ajuste de −18).
                </small>
              </>
            )}
          </div>
        )}
      </div>
 
      {previa && (
        <div
          className={`sigsam-notice ${previa.ok ? "info" : "warning"}`}
          style={{ marginTop: 16 }}
          role="status"
        >
          <span className="sigsam-notice-symbol" aria-hidden="true">
            {previa.ok ? "i" : "!"}
          </span>
          <div>
            <strong>
              {previa.ok ? "Resultado del movimiento" : "Stock insuficiente"}
            </strong>
            <p>
              {previa.ok
                ? `Saldo del lote: ${previa.saldoLote} dosis · Stock físico de ${vacuna.nombre}: ${previa.fisicoVacuna} dosis.`
                : previa.error}
            </p>
          </div>
        </div>
      )}
 
      <div className="sigsam-form-actions">
        <button className="sigsam-btn" type="submit" disabled={pendiente}>
          {pendiente ? "Registrando…" : "Registrar movimiento"}
        </button>
      </div>
      <p className="sigsam-muted" style={{ fontSize: 13, marginTop: 12 }}>
        La fecha de registro y el operador se asignan automáticamente. Los
        movimientos no se editan ni se borran. Las bajas por aplicación se
        generan al registrar una vacuna aplicada.
      </p>
    </form>
  );
}