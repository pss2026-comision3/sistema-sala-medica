import Link from "next/link";

import { PublicShell } from "@/components/public-shell";
import { RecuperarForm } from "@/app/recuperar/recuperar-form";

export default function RecuperarPage() {
  return (
    <PublicShell>
      <div className="sigsam-public-card">
        <div className="sigsam-eyebrow">Acceso a SIGSAM</div>
        <h1>Recuperar acceso</h1>
        <p className="sigsam-muted sigsam-maxline">
          La recuperación de contraseñas se realiza con ayuda presencial de
          Administración.
        </p>

        <div className="sigsam-notice info">
          <span className="sigsam-notice-symbol" aria-hidden="true">
            i
          </span>
          <div>
            <strong>Recuperación asistida</strong>
            <p>
              Administración verifica tu identidad y te entrega una clave
              temporal. El cambio es obligatorio al volver a ingresar.
            </p>
          </div>
        </div>

        <hr className="sigsam-divider" />

        <h2>Cambiar clave temporal</h2>
        <p className="sigsam-muted">
          Si ya tenés tu clave temporal, definí acá tu nueva contraseña.
        </p>
        <RecuperarForm />

        <div className="sigsam-public-links">
          <Link href="/login" className="sigsam-link">
            Volver a ingresar
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
