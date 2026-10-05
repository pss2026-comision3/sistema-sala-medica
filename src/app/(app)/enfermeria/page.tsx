import { requireRole } from "@/lib/auth/guards";

export default async function EnfermeriaInicioPage() {
  const sesion = await requireRole("ENFERMERIA");
  return (
    <>
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1>Hola, {sesion.nombre.split(" ")[0]}</h1>
          <p>
            Desde acá vas a poder registrar pacientes presenciales y aplicar
            vacunas.
          </p>
        </div>
      </div>
      <div className="sigsam-empty">
        <p>Esta función se incorpora en otra historia de usuario.</p>
      </div>
    </>
  );
}
