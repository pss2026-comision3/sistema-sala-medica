"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiltrosHistorialBar } from "@/components/paciente/historial/filtros-historial-bar";
import { ConsultaHistorialCard } from "@/components/paciente/historial/consulta-historial-card";
import { VacunasHistorialTable } from "@/components/paciente/historial/vacunas-historial-table";
import type {
  BeneficiarioInfo,
  ConsultaHistorialItem,
  EspecialidadFiltroItem,
  VacunaAplicadaItem,
} from "@/lib/turnos/historial-clinico";

type Props = {
  beneficiarios: BeneficiarioInfo[];
  beneficiarioSeleccionadoId: string;
  consultas: ConsultaHistorialItem[];
  vacunas: VacunaAplicadaItem[];
  especialidades: EspecialidadFiltroItem[];
  filtros: {
    desde?: string;
    hasta?: string;
    especialidadId?: string;
  };
  seccionInicial?: "consultas" | "vacunas";
};

export function HistorialView({
  beneficiarios,
  beneficiarioSeleccionadoId,
  consultas,
  vacunas,
  especialidades,
  filtros,
  seccionInicial = "consultas",
}: Props) {
  const router = useRouter();
  const [seccion, setSeccion] = useState<"consultas" | "vacunas">(
    seccionInicial,
  );

  const beneficiarioActual =
    beneficiarios.find((b) => b.id === beneficiarioSeleccionadoId) ??
    beneficiarios[0];

  const construirUrl = (nuevos: {
    beneficiario?: string;
    desde?: string;
    hasta?: string;
    especialidadId?: string;
    seccion?: string;
  }) => {
    const params = new URLSearchParams();
    const bId = nuevos.beneficiario ?? beneficiarioSeleccionadoId;
    if (bId) params.set("beneficiario", bId);

    const desde = nuevos.desde !== undefined ? nuevos.desde : filtros.desde;
    const hasta = nuevos.hasta !== undefined ? nuevos.hasta : filtros.hasta;
    const esp =
      nuevos.especialidadId !== undefined
        ? nuevos.especialidadId
        : filtros.especialidadId;
    const sec = nuevos.seccion !== undefined ? nuevos.seccion : seccion;

    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    if (esp) params.set("especialidad", esp);
    if (sec && sec !== "consultas") params.set("seccion", sec);

    const qs = params.toString();
    return qs ? `/paciente/historial?${qs}` : "/paciente/historial";
  };

  const cambiarBeneficiario = (nuevoId: string) => {
    // Al cambiar de beneficiario se limpian los filtros de fecha y especialidad
    router.replace(
      construirUrl({
        beneficiario: nuevoId,
        desde: "",
        hasta: "",
        especialidadId: "",
      }),
    );
  };

  const aplicarFiltros = (f: {
    desde?: string;
    hasta?: string;
    especialidadId?: string;
  }) => {
    router.replace(construirUrl(f));
  };

  const limpiarFiltros = () => {
    router.replace(
      construirUrl({
        desde: "",
        hasta: "",
        especialidadId: "",
      }),
    );
  };

  const tieneFiltrosActivos =
    Boolean(filtros.desde) ||
    Boolean(filtros.hasta) ||
    Boolean(filtros.especialidadId);

  return (
    <div>
      {/* Selector de Beneficiario (CA1) */}
      <div className="sigsam-card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Paciente representado</h2>
        {beneficiarios.length > 1 ? (
          <div className="sigsam-field">
            <label htmlFor="selector-beneficiario">Seleccionar paciente</label>
            <select
              id="selector-beneficiario"
              value={beneficiarioSeleccionadoId}
              onChange={(e) => cambiarBeneficiario(e.target.value)}
            >
              {beneficiarios.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre} — {b.tipo}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p style={{ margin: 0 }}>
            Visualizando la ficha de:{" "}
            <strong>{beneficiarioActual?.nombre}</strong> (
            {beneficiarioActual?.tipo})
          </p>
        )}
      </div>

      {/* Aviso de Solo Lectura (CA3 / CA5) */}
      <div className="sigsam-notice info" style={{ marginBottom: 16 }}>
        <span className="sigsam-notice-symbol">i</span>
        <div>
          <strong>Solo lectura</strong>
          <p style={{ margin: "2px 0 0" }}>
            Las consultas médicas y aplicaciones de vacunas son registradas por
            los profesionales de la sala; el contenido original y sus
            correcciones se conservan de forma inmutable.
          </p>
        </div>
      </div>

      {/* Pestañas de navegación de historia clínica (CA4) */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: 16,
          borderBottom: "1px solid var(--color-line, #cbd5e1)",
          paddingBottom: "8px",
        }}
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          aria-selected={seccion === "consultas"}
          className={`sigsam-btn ${seccion === "consultas" ? "secondary" : "ghost"}`}
          onClick={() => setSeccion("consultas")}
        >
          Consultas médicas ({consultas.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={seccion === "vacunas"}
          className={`sigsam-btn ${seccion === "vacunas" ? "secondary" : "ghost"}`}
          onClick={() => setSeccion("vacunas")}
        >
          Vacunas aplicadas ({vacunas.length})
        </button>
      </div>

      {/* Contenido: Consultas Médicas */}
      {seccion === "consultas" && (
        <section>
          {/* Barra de filtros (CA2) */}
          <FiltrosHistorialBar
            desdeInicial={filtros.desde}
            hastaInicial={filtros.hasta}
            especialidadInicial={filtros.especialidadId}
            especialidades={especialidades}
            onAplicar={aplicarFiltros}
            onLimpiar={limpiarFiltros}
          />

          {consultas.length === 0 ? (
            <div className="sigsam-card">
              <div className="sigsam-notice info">
                <span className="sigsam-notice-symbol">i</span>
                <p style={{ margin: 0 }}>
                  {tieneFiltrosActivos
                    ? "No se encontraron consultas para los filtros seleccionados."
                    : "Aún no hay consultas registradas para este paciente."}
                </p>
              </div>
            </div>
          ) : (
            <div>
              {consultas.map((consulta) => (
                <ConsultaHistorialCard
                  key={consulta.turnoId}
                  consulta={consulta}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Contenido: Vacunas Aplicadas (CA4) */}
      {seccion === "vacunas" && (
        <section>
          <VacunasHistorialTable vacunas={vacunas} />
        </section>
      )}
    </div>
  );
}
