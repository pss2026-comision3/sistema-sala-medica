import { SuspenderJornadaPanel } from "@/components/agenda/suspender-jornada-panel";

import { MedicoDisponibilidadView } from "./medico-disponibilidad-view";

export default function MedicoDisponibilidadPage() {
  return (
    <>
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1>Disponibilidad</h1>
          <p>Días y horarios que publicás para tus turnos.</p>
        </div>
      </div>

      <MedicoDisponibilidadView />

      {/* US-009: suspender una jornada propia ante un imprevisto. */}
      <SuspenderJornadaPanel modo="medico" />
    </>
  );
}
