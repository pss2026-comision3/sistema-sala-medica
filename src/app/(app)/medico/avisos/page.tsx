import { requireRole } from "@/lib/auth/guards";
import { obtenerBandejaAvisos } from "@/lib/notificaciones/avisos";
import { BandejaAvisos } from "@/components/avisos/bandeja-avisos";

export default async function AvisosMedicoPage() {
  const sesion = await requireRole("MEDICO");
  const avisos = await obtenerBandejaAvisos({
    usuarioId: BigInt(sesion.usuarioId),
    rol: "MEDICO",
  });

  return (
    <BandejaAvisos
      avisos={avisos}
      rol="MEDICO"
      titulo="Avisos"
      descripcion="Confirmaciones, cancelaciones y novedades de tus turnos."
    />
  );
}
