import { requireRole } from "@/lib/auth/guards";
import { obtenerCatalogoConStock } from "@/lib/vacunacion/stock";

import { VacunasView } from "./vacunas-view";

export default async function VacunasPage() {
  await requireRole("ENFERMERIA");
  const vacunas = await obtenerCatalogoConStock();

  return (
    <>
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">Enfermería</div>
          <h1>Vacunas</h1>
          <p>
            Gestioná el catálogo de vacunas y consultá las dosis disponibles por
            lote. El stock se actualiza únicamente con los movimientos de cada
            lote.
          </p>
        </div>
      </div>

      <VacunasView iniciales={vacunas} />
    </>
  );
}
