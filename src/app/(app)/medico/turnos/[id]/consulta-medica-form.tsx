"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { registrarConsultaMedicaAction } from "@/app/actions/consultas";
import { MSG } from "@/lib/auth/constants";

interface Props {
  turnoId: string;
}

export function ConsultaMedicaForm({ turnoId }: Props) {
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
    const diagnostico = formData.get("diagnostico")?.toString().trim() ?? "";

    if (!diagnostico) {
      setError(MSG.CONSULTA_DIAGNOSTICO_REQUERIDO);
      return;
    }

    startTransition(async () => {
      const res = await registrarConsultaMedicaAction(formData);
      if (!res.exito) {
        setError(res.error);
        return;
      }
      setExito(res.mensaje);
      router.refresh();
    });
  };

  return (
    <div className="sigsam-card" style={{ marginTop: "16px" }}>
      <div style={{ marginBottom: "16px" }}>
        <h2>Registrar consulta médica</h2>
        <p className="sigsam-muted" style={{ margin: "4px 0 0" }}>
          Documentá el diagnóstico y las indicaciones de la atención prestada.
          El diagnóstico es obligatorio. Los datos guardados no se pueden
          modificar retrospectivamente (CA4).
        </p>
      </div>

      {exito && (
        <div
          className="sigsam-notice success"
          role="status"
          style={{ marginBottom: "16px" }}
        >
          <span className="sigsam-notice-symbol" aria-hidden="true">
            ✓
          </span>
          <div>
            <strong>Atención registrada</strong>
            <p style={{ margin: 0, fontSize: "14px" }}>{exito}</p>
          </div>
        </div>
      )}

      {error && (
        <div
          className="sigsam-notice error"
          role="alert"
          style={{ marginBottom: "16px" }}
        >
          <span className="sigsam-notice-symbol" aria-hidden="true">
            !
          </span>
          <div>
            <strong>No se pudo guardar la consulta</strong>
            <p style={{ margin: 0, fontSize: "14px" }}>{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <input type="hidden" name="turnoId" value={turnoId} />

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="sigsam-field">
            <label htmlFor="consulta-diagnostico" style={{ fontWeight: 600 }}>
              Diagnóstico *
            </label>
            <textarea
              id="consulta-diagnostico"
              name="diagnostico"
              rows={3}
              required
              aria-required="true"
              placeholder="Detalle el diagnóstico clínico del paciente..."
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--color-line, #d7e2e4)",
                fontFamily: "inherit",
                fontSize: "14px",
              }}
            />
            <small className="sigsam-muted" style={{ fontSize: "12px" }}>
              Campo obligatorio. No puede estar vacío.
            </small>
          </div>

          <div className="sigsam-field">
            <label htmlFor="consulta-sintomas" style={{ fontWeight: 600 }}>
              Síntomas (opcional)
            </label>
            <textarea
              id="consulta-sintomas"
              name="sintomas"
              rows={2}
              placeholder="Motivo de consulta, síntomas referidos y tiempo de evolución..."
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--color-line, #d7e2e4)",
                fontFamily: "inherit",
                fontSize: "14px",
              }}
            />
          </div>

          <div className="sigsam-field">
            <label htmlFor="consulta-indicaciones" style={{ fontWeight: 600 }}>
              Indicaciones y pautas de alarma (opcional)
            </label>
            <textarea
              id="consulta-indicaciones"
              name="indicaciones"
              rows={2}
              placeholder="Reposo, cuidados generales, pautas de alarma..."
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--color-line, #d7e2e4)",
                fontFamily: "inherit",
                fontSize: "14px",
              }}
            />
          </div>

          <div className="sigsam-field">
            <label htmlFor="consulta-medicacion" style={{ fontWeight: 600 }}>
              Medicación recetada (opcional)
            </label>
            <textarea
              id="consulta-medicacion"
              name="medicacion"
              rows={2}
              placeholder="Fármaco, dosis, vía de administración e intervalo..."
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--color-line, #d7e2e4)",
                fontFamily: "inherit",
                fontSize: "14px",
              }}
            />
          </div>

          <div className="sigsam-field">
            <label htmlFor="consulta-estudios" style={{ fontWeight: 600 }}>
              Estudios solicitados (opcional)
            </label>
            <textarea
              id="consulta-estudios"
              name="estudios"
              rows={2}
              placeholder="Laboratorio, ecografía, radiografías..."
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--color-line, #d7e2e4)",
                fontFamily: "inherit",
                fontSize: "14px",
              }}
            />
          </div>

          <div className="sigsam-field">
            <label htmlFor="consulta-observaciones" style={{ fontWeight: 600 }}>
              Observaciones (opcional)
            </label>
            <textarea
              id="consulta-observaciones"
              name="observaciones"
              rows={2}
              placeholder="Notas adicionales o evolución previa..."
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--color-line, #d7e2e4)",
                fontFamily: "inherit",
                fontSize: "14px",
              }}
            />
          </div>

          <div className="sigsam-field">
            <label htmlFor="consulta-certificado" style={{ fontWeight: 600 }}>
              Certificado médico (opcional)
            </label>
            <textarea
              id="consulta-certificado"
              name="certificado"
              rows={2}
              placeholder="Texto del certificado médico o constancia de atención..."
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--color-line, #d7e2e4)",
                fontFamily: "inherit",
                fontSize: "14px",
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: "20px" }}>
          <button
            type="submit"
            className="sigsam-btn primary"
            disabled={isPending}
            style={{ minHeight: "44px", minWidth: "160px" }}
          >
            {isPending ? "Guardando consulta…" : "Registrar consulta"}
          </button>
        </div>
      </form>
    </div>
  );
}
