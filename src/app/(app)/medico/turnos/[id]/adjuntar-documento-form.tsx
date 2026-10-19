"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { adjuntarDocumentoConsultaAction } from "@/app/actions/adjuntos";
import { MSG } from "@/lib/auth/constants";

const ADJUNTO_MAX_BYTES = 10 * 1024 * 1024;
const MIME_PERMITIDOS = new Set(["application/pdf", "image/jpeg", "image/png"]);

interface Props {
  turnoId: string;
}

export function AdjuntarDocumentoForm({ turnoId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setExito(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const nombre = formData.get("nombre")?.toString().trim() ?? "";
    const archivo = formData.get("archivo");

    if (!nombre) {
      setError(MSG.ADJUNTO_NOMBRE_REQUERIDO);
      return;
    }
    if (nombre.length > 255) {
      setError(MSG.ADJUNTO_NOMBRE_LARGO);
      return;
    }
    if (!(archivo instanceof File) || archivo.size === 0) {
      setError(MSG.ADJUNTO_ARCHIVO_REQUERIDO);
      return;
    }
    if (archivo.size > ADJUNTO_MAX_BYTES) {
      setError(MSG.ADJUNTO_TAMANO_EXCEDIDO);
      return;
    }
    if (!MIME_PERMITIDOS.has(archivo.type)) {
      setError(MSG.ADJUNTO_TIPO_INVALIDO);
      return;
    }

    startTransition(async () => {
      const res = await adjuntarDocumentoConsultaAction(formData);
      if (!res.exito) {
        setError(res.error);
        return;
      }
      setExito(res.mensaje);
      form.reset();
      router.refresh();
    });
  };

  return (
    <div className="sigsam-card" style={{ marginTop: "16px" }}>
      <div style={{ marginBottom: "12px" }}>
        <h3 style={{ margin: 0 }}>Adjuntar documento</h3>
        <p
          className="sigsam-muted"
          style={{ margin: "4px 0 0", fontSize: "13px" }}
        >
          PDF, JPG o PNG · hasta 10 MB. El nombre descriptivo es obligatorio.
        </p>
      </div>

      {exito && (
        <div
          className="sigsam-notice success"
          role="status"
          style={{ marginBottom: "12px" }}
        >
          <span className="sigsam-notice-symbol" aria-hidden="true">
            ✓
          </span>
          <div>
            <p style={{ margin: 0, fontSize: "14px" }}>{exito}</p>
          </div>
        </div>
      )}

      {error && (
        <div
          className="sigsam-notice error"
          role="alert"
          style={{ marginBottom: "12px" }}
        >
          <span className="sigsam-notice-symbol" aria-hidden="true">
            !
          </span>
          <div>
            <p style={{ margin: 0, fontSize: "14px" }}>{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <input type="hidden" name="turnoId" value={turnoId} />

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div className="sigsam-field">
            <label htmlFor="adjunto-nombre" style={{ fontWeight: 600 }}>
              Nombre descriptivo *
            </label>
            <input
              id="adjunto-nombre"
              name="nombre"
              type="text"
              required
              maxLength={255}
              placeholder="Ej.: Radiografía de tórax"
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--color-line, #d7e2e4)",
                fontSize: "14px",
              }}
            />
          </div>

          <div className="sigsam-field">
            <label htmlFor="adjunto-archivo" style={{ fontWeight: 600 }}>
              Archivo *
            </label>
            <input
              id="adjunto-archivo"
              name="archivo"
              type="file"
              required
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--color-line, #d7e2e4)",
                fontSize: "14px",
              }}
            />
          </div>

          <button
            type="submit"
            className="sigsam-btn"
            disabled={isPending}
            style={{ minHeight: "44px" }}
          >
            {isPending ? "Adjuntando documento…" : "Adjuntar documento"}
          </button>
        </div>
      </form>
    </div>
  );
}
