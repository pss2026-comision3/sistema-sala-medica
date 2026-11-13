import { requireRole } from "@/lib/auth/guards";
import { obtenerBandejaAvisos } from "@/lib/notificaciones/avisos";
import { BandejaAvisos } from "@/components/avisos/bandeja-avisos";

export default async function AvisosEnfermeriaPage() {
  const sesion = await requireRole("ENFERMERIA");
  const avisos = await obtenerBandejaAvisos({
    usuarioId: BigInt(sesion.usuarioId),
    rol: "ENFERMERIA",
  });

  return (
    <BandejaAvisos
      avisos={avisos}
      rol="ENFERMERIA"
      titulo="Avisos"
      descripcion="Alertas de stock y notificaciones de atención."
    />
  );
}
