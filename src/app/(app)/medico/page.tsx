import { requireRole } from "@/lib/auth/guards";

export default async function MedicoInicioPage() {
  const sesion = await requireRole("MEDICO");
  return (
    <>
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1>Hola, {sesion.nombre.split(" ")[0]}</h1>
          <p>
            Acá vas a ver tu agenda del día y los próximos turnos reservados.
          </p>
        </div>
      </div>
      <div className="sigsam-empty">
        <p>Esta función se incorpora en otra historia de usuario.</p>
      </div>
    </>
  );
}
