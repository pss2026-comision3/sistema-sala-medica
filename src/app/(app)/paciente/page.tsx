import { requireRole } from "@/lib/auth/guards";

export default async function PacienteInicioPage() {
  const sesion = await requireRole("PACIENTE");
  return (
    <>
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1>Hola, {sesion.nombre.split(" ")[0]}</h1>
          <p>Consultá tus próximos turnos y seguí cada paso de tu atención.</p>
        </div>
      </div>
      <div className="sigsam-empty">
        <p>Esta función se incorpora en otra historia de usuario.</p>
      </div>
    </>
  );
}
