import Link from "next/link";
import { redirect } from "next/navigation";

import { INICIO_POR_ROL } from "@/lib/auth/constants";
import { requireSession } from "@/lib/auth/guards";
import { CambiarClavePropiaForm } from "./cambiar-clave-propia-form";

export default async function CuentaClavePage() {
  const sesion = await requireSession();
  if (sesion.claveTemporal) {
    redirect("/cambiar-clave");
  }

  return (
    <div className="sigsam-content-grid" style={{ maxWidth: "640px" }}>
      <section className="sigsam-card">
        <header className="sigsam-card-header">
          <div>
            <div className="sigsam-eyebrow">Seguridad de la cuenta</div>
            <h1>Cambiar mi contraseña</h1>
            <p className="sigsam-muted">
              Modificá tu contraseña actual por una nueva de al menos 8
              caracteres.
            </p>
          </div>
        </header>

        <div style={{ marginTop: "16px" }}>
          <CambiarClavePropiaForm />
        </div>

        <div style={{ marginTop: "24px" }}>
          <Link
            href={INICIO_POR_ROL[sesion.rol]}
            className="sigsam-link"
            style={{ paddingLeft: 0 }}
          >
            ← Volver al inicio
          </Link>
        </div>
      </section>
    </div>
  );
}
