import { redirect } from "next/navigation";

import { destinoPostLogin } from "@/lib/auth/guards";
import { getSession } from "@/lib/auth/session";
import { PublicShell } from "@/components/public-shell";
import { LoginForm } from "@/app/login/login-form";

type Props = {
  searchParams: Promise<{ recuperado?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const sesion = await getSession();
  if (sesion) redirect(destinoPostLogin(sesion));

  const { recuperado } = await searchParams;

  return (
    <PublicShell>
      <div className="sigsam-public-card">
        <div className="sigsam-eyebrow">Acceso a SIGSAM</div>
        <h1>Bienvenido a SIGSAM</h1>
        <p className="sigsam-muted sigsam-maxline">
          Ingresá con tu cuenta para gestionar turnos y consultar información
          autorizada.
        </p>
        {recuperado ? (
          <div className="sigsam-notice success" role="status">
            <span className="sigsam-notice-symbol" aria-hidden="true">
              ✓
            </span>
            <div>
              <strong>Clave actualizada</strong>
              <p>Ya podés iniciar sesión con tu nueva contraseña.</p>
            </div>
          </div>
        ) : null}
        <LoginForm />
      </div>
    </PublicShell>
  );
}
