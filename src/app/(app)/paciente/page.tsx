import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";

export default async function PacienteInicioPage() {
  const sesion = await requireRole("PACIENTE");
  const primerNombre = sesion.nombre.split(" ")[0];

  return (
    <div>
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1>Hola, {primerNombre}</h1>
          <p>Consultá tus próximos turnos y seguí cada paso de tu atención.</p>
        </div>
      </div>

      <div
        className="sigsam-grid cols-2"
        style={{ gap: "16px", marginTop: "16px" }}
      >
        <div className="sigsam-card">
          <h2 style={{ marginTop: 0 }}>Mi historia clínica</h2>
          <p className="sigsam-muted" style={{ fontSize: "14px" }}>
            Revisá tus consultas médicas anteriores, diagnósticos, correcciones,
            documentación adjunta y registro de vacunas aplicadas en solo
            lectura.
          </p>
          <div style={{ marginTop: "16px" }}>
            <Link href="/paciente/historial" className="sigsam-btn secondary">
              Ver historia clínica
            </Link>
          </div>
        </div>

        <div className="sigsam-card">
          <h2 style={{ marginTop: 0 }}>Mis turnos</h2>
          <p className="sigsam-muted" style={{ fontSize: "14px" }}>
            Consultá tus próximas citas confirmadas, resoluciones de jornadas y
            gestión de cancelaciones con anticipación.
          </p>
          <div style={{ marginTop: "16px" }}>
            <Link href="/paciente/turnos" className="sigsam-btn secondary">
              Ver mis turnos
            </Link>
          </div>
        </div>

        <div className="sigsam-card">
          <h2 style={{ marginTop: 0 }}>Buscar un turno</h2>
          <p className="sigsam-muted" style={{ fontSize: "14px" }}>
            Buscá disponibilidad médica por especialidad, profesional y fecha
            para vos o para las personas menores que representás.
          </p>
          <div style={{ marginTop: "16px" }}>
            <Link href="/paciente/buscar" className="sigsam-btn secondary">
              Buscar turnos
            </Link>
          </div>
        </div>

        <div className="sigsam-card">
          <h2 style={{ marginTop: 0 }}>Bandeja de avisos</h2>
          <p className="sigsam-muted" style={{ fontSize: "14px" }}>
            Revisá las notificaciones del sistema sobre confirmaciones de citas,
            reprogramaciones y recordatorios.
          </p>
          <div style={{ marginTop: "16px" }}>
            <Link href="/paciente/avisos" className="sigsam-btn secondary">
              Ver avisos
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
