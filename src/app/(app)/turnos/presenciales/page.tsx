import { ReservarCitaPresencialPanel } from "@/components/agenda/ReservarCitaPresencialPanel";
import { hoySala } from "@/lib/agenda/reglas";

export default function TurnosPresencialesPage() {
  return (
    <>
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1>Turnos presenciales</h1>
          <p>
            Reservá o cancelá una cita médica para un paciente que viene a la
            sala. Queda registrada la cuenta que operó.
          </p>
        </div>
      </div>

      <ReservarCitaPresencialPanel hoy={hoySala()} />
    </>
  );
}
