import { requireRole } from "@/lib/auth/guards";
import { obtenerBandejaAvisos } from "@/lib/notificaciones/avisos";
import { BandejaAvisos } from "@/components/avisos/bandeja-avisos";

export default async function AvisosAdminPage() {
  const sesion = await requireRole("ADMIN");
  const avisos = await obtenerBandejaAvisos({
    usuarioId: BigInt(sesion.usuarioId),
    rol: "ADMIN",
  });

  return (
    <BandejaAvisos
      avisos={avisos}
      rol="ADMIN"
      titulo="Avisos"
      descripcion="Avisos y novedades del sistema."
    />
  );
}
