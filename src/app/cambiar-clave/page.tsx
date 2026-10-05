import { redirect } from "next/navigation";

import { INICIO_POR_ROL } from "@/lib/auth/constants";
import { getSession } from "@/lib/auth/session";
import { PublicShell } from "@/components/public-shell";
import { LogoutButton } from "@/components/logout-button";
import { CambiarClaveForm } from "@/app/cambiar-clave/cambiar-clave-form";

export default async function CambiarClavePage() {
  const sesion = await getSession();
  if (!sesion) redirect("/login");
  if (!sesion.claveTemporal) redirect(INICIO_POR_ROL[sesion.rol]);

  return (
    <PublicShell>
      <div className="sigsam-public-card">
        <div className="sigsam-eyebrow">Acceso a SIGSAM</div>
        <h1>Cambiar clave temporal</h1>
        <p className="sigsam-muted sigsam-maxline">
          Hola, {sesion.nombre}. Tenés que definir una nueva contraseña antes de
          continuar.
        </p>

        <div className="sigsam-notice warning">
          <span className="sigsam-notice-symbol" aria-hidden="true">
            !
          </span>
          <div>
            <strong>Cambio obligatorio</strong>
            <p>
              Usá tu clave temporal y definí una nueva contraseña de al menos 8
              caracteres.
            </p>
          </div>
        </div>

        <CambiarClaveForm camposIniciales={{}} />

        <div className="sigsam-public-links">
          <LogoutButton />
        </div>
      </div>
    </PublicShell>
  );
}
