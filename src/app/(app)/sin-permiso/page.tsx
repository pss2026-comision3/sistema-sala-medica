import Link from "next/link";

import { INICIO_POR_ROL } from "@/lib/auth/constants";
import { requireSession } from "@/lib/auth/guards";

export default async function SinPermisoPage() {
  const sesion = await requireSession();

  return (
    <>
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1>Acceso restringido</h1>
          <p>Tu rol no tiene permiso para abrir esta pantalla.</p>
        </div>
      </div>
      <div className="sigsam-empty">
        <p>
          <Link href={INICIO_POR_ROL[sesion.rol]} className="sigsam-link">
            Volver al inicio
          </Link>
        </p>
      </div>
    </>
  );
}
