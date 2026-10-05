import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export function PublicShell({ children }: Props) {
  return (
    <div className="sigsam-public-layout">
      <aside className="sigsam-public-aside">
        <Link href="/login" className="sigsam-brand" aria-label="SIGSAM">
          <span className="sigsam-brand-mark" aria-hidden="true">
            +
          </span>
          SIGSAM
        </Link>
        <div>
          <h1>
            <strong>Tu salud, con tiempo para vos.</strong>
          </h1>
          <p>Organizá tus turnos médicos desde un espacio claro y seguro.</p>
        </div>
        <small>Prototipo de la sala médica · Datos ficticios</small>
      </aside>
      <main className="sigsam-public-main">{children}</main>
    </div>
  );
}
