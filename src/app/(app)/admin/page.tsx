import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/guards";
import { AdminCuentasTable, type CuentaItem } from "./admin-cuentas-table";
import NuevaCuentaForm from "./nueva-cuenta-form";

export default async function AdminInicioPage() {
  const sesion = await requireRole("ADMIN");

  const usuarios = await prisma.usuario.findMany({
    include: {
      persona: true,
    },
    orderBy: [{ activo: "desc" }, { persona: { nombreCompleto: "asc" } }],
  });

  // Hacemos la query para traer las especialidades de la base[cite: 60, 61]
  const especialidades = await prisma.especialidad.findMany({
    orderBy: { nombre: "asc" },
  });

  // Parseamos el BigInt a string para poder pasarlo al Client Component
  const especialidadesFormat = especialidades.map((esp) => ({
    id: esp.id.toString(),
    nombre: esp.nombre,
  }));

  const cuentas: CuentaItem[] = usuarios.map((u) => ({
    id: u.id.toString(),
    email: u.email,
    nombre: u.persona.nombreCompleto,
    rol: u.rol,
    activo: u.activo,
    claveTemporal: u.claveTemporal,
  }));

  return (
    <>
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">Panel de Administración</div>
          <h1>Hola, {sesion.nombre.split(" ")[0]}</h1>
          <p>
            Desde acá podés gestionar los accesos, buscar cuentas de personal y
            pacientes para restablecer contraseñas presencialmente y administrar
            la sala médica.
          </p>
        </div>
      </div>

      {/* US-004: crear cuentas de personal, primera sección del inicio. */}
      <section className="sigsam-card" style={{ marginBottom: "28px" }}>
        <header className="sigsam-card-header" style={{ marginBottom: "20px" }}>
          <div>
            <h2>Crear cuenta de personal</h2>
            <p className="sigsam-muted">
              La cuenta recibe una clave temporal y debe cambiarla al ingresar.
            </p>
          </div>
        </header>

        <NuevaCuentaForm especialidades={especialidadesFormat} />
      </section>

      <section className="sigsam-card">
        <header className="sigsam-card-header" style={{ marginBottom: "20px" }}>
          <div>
            <h2>Gestión de cuentas y recuperación de acceso</h2>
            <p className="sigsam-muted">
              Identificá presencialmente al solicitante. Al generar una clave
              temporal, todas sus sesiones abiertas se cierran de inmediato.
            </p>
          </div>
        </header>

        <AdminCuentasTable cuentasIniciales={cuentas} />
      </section>
    </>
  );
}
