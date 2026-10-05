import { requireRole } from "@/lib/auth/guards";

export default async function AdminInicioPage() {
  const sesion = await requireRole("ADMIN");
  return (
    <>
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1>Hola, {sesion.nombre.split(" ")[0]}</h1>
          <p>
            Desde acá vas a poder administrar pacientes, profesionales y los
            parámetros generales del sistema.
          </p>
        </div>
      </div>
      <div className="sigsam-empty">
        <p>Esta función se incorpora en otra historia de usuario.</p>
      </div>
    </>
  );
}
