import { requireRole } from "@/lib/auth/guards";
import { obtenerBandejaAvisos } from "@/lib/notificaciones/avisos";
import { BandejaAvisos } from "@/components/avisos/bandeja-avisos";

export default async function AvisosPacientePage() {
  const sesion = await requireRole("PACIENTE");
  const avisos = await obtenerBandejaAvisos({
    usuarioId: BigInt(sesion.usuarioId),
    rol: "PACIENTE",
  });

  return (
    <BandejaAvisos
      avisos={avisos}
      rol="PACIENTE"
      titulo="Avisos"
      descripcion="Confirmaciones, cambios y recordatorios reunidos en un solo lugar."
    />
  );
}
