import { esFechaValida, hoySala } from "@/lib/agenda/reglas";
import { requireRole } from "@/lib/auth/guards";
import {
  listarMovimientosInventario,
  obtenerOpcionesFiltroInventario,
  obtenerVacunasParaMovimientos,
  type FiltrosMovimientos,
} from "@/lib/vacunacion/inventario";
import {
  MSG_INVENTARIO,
  TIPOS_MOVIMIENTO,
  type TipoMovimientoInventario,
} from "@/lib/vacunacion/inventario-reglas";
 
import { HistorialMovimientos } from "./historial-movimientos";
import { RegistrarMovimientoForm } from "./registrar-movimiento-form";
 
type Parametros = Record<string, string | string[] | undefined>;
 
const unico = (valor: string | string[] | undefined) =>
  Array.isArray(valor) ? valor[0] : valor;
 
const esId = (valor: string | undefined): valor is string =>
  !!valor && /^[1-9]\d*$/.test(valor);
 
/** Lee los filtros de la URL descartando valores inválidos (CA4). */
function leerFiltros(params: Parametros): {
  filtros: FiltrosMovimientos;
  error: string | null;
} {
  const vacuna = unico(params.vacuna);
  const lote = unico(params.lote);
  const tipo = unico(params.tipo);
  let desde = unico(params.desde);
  let hasta = unico(params.hasta);
  if (!esFechaValida(desde)) desde = undefined;
  if (!esFechaValida(hasta)) hasta = undefined;
 
  let error: string | null = null;
  if (desde && hasta && desde > hasta) {
    error = MSG_INVENTARIO.FILTRO_PERIODO;
    desde = undefined;
    hasta = undefined;
  }
 
  return {
    filtros: {
      vacunaId: esId(vacuna) ? vacuna : undefined,
      loteId: esId(lote) ? lote : undefined,
      tipo: TIPOS_MOVIMIENTO.includes(tipo as TipoMovimientoInventario)
        ? (tipo as TipoMovimientoInventario)
        : undefined,
      desde,
      hasta,
    },
    error,
  };
}
 
export default async function InventarioPage(props: {
  searchParams: Promise<Parametros>;
}) {
  await requireRole("ENFERMERIA");
  const { filtros, error } = leerFiltros(await props.searchParams);
 
  const ahora = new Date();
  const [vacunas, opciones, historial] = await Promise.all([
    obtenerVacunasParaMovimientos(ahora),
    obtenerOpcionesFiltroInventario(),
    listarMovimientosInventario(filtros),
  ]);
 
  return (
    <>
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">Enfermería</div>
          <h1>Inventario de vacunas</h1>
          <p>
            Registrá entradas por compra y ajustes por lote, y consultá la
            trazabilidad de cada movimiento con su saldo posterior.
          </p>
        </div>
      </div>
 
      <section className="sigsam-card" style={{ marginBottom: 28 }}>
        <h2>Registrar movimiento</h2>
        <RegistrarMovimientoForm vacunas={vacunas} hoy={hoySala(ahora)} />
      </section>
 
      <section className="sigsam-card">
        <h2>Historial de movimientos</h2>
        <HistorialMovimientos
          movimientos={historial.movimientos}
          total={historial.total}
          filtros={filtros}
          opciones={opciones}
          errorFiltros={error}
        />
      </section>
    </>
  );
}