import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { obtenerDefinicionReporte } from "@/lib/reportes/registry";
import { consultarReporteAsistencia } from "@/lib/reportes/asistencia-recordatorios";
import { consultarReporteOcupacion } from "@/lib/reportes/turnos-ocupacion";
import { consultarReporteInventario } from "@/lib/reportes/inventario";
import { consultarReporteCobertura } from "@/lib/reportes/cobros-cobertura";
import { huellaReporte } from "@/lib/reportes/exportacion/huella";
import {
  proyectarAsistencia,
  proyectarOcupacion,
  proyectarInventario,
  proyectarCobertura,
} from "@/lib/reportes/exportacion/modelo";
import { generarPdf, generarXlsx } from "@/lib/reportes/exportacion/archivos";

export const runtime = "nodejs";

const id = z
  .string()
  .regex(/^[1-9]\d*$/)
  .optional();
const comun = {
  desde: z.iso.date(),
  hasta: z.iso.date(),
};
const esquemas = {
  asistencia_recordatorios: z
    .object({ ...comun, medicoId: id, especialidadId: id })
    .strict(),
  turnos_ocupacion: z
    .object({
      ...comun,
      medicoId: id,
      especialidadId: id,
      estado: z.enum(["todos", "CONFIRMADO", "CANCELADO"]).optional(),
      modalidad: z.enum(["todos", "PARTICULAR", "CON_COBERTURA"]).optional(),
    })
    .strict(),
  inventario: z
    .object({
      ...comun,
      vacunaId: id,
      loteId: id,
      tipo: z.enum(["COMPRA", "APLICACION", "AJUSTE"]).optional(),
    })
    .strict(),
  cobros_cobertura: z
    .object({
      ...comun,
      medicoId: id,
      especialidadId: id,
      obraSocialId: id,
      categoria: z
        .enum(["todas", "PARTICULAR", "GRATUITA", "CON_COBERTURA"])
        .optional(),
    })
    .strict(),
} as const;

const cabecera = z
  .object({
    tipoReporte: z.enum([
      "asistencia_recordatorios",
      "turnos_ocupacion",
      "inventario",
      "cobros_cobertura",
    ]),
    formato: z.enum(["pdf", "xlsx"]),
    huella: z.string().regex(/^[a-f0-9]{64}$/),
    filtros: z.unknown(),
  })
  .strict();

const errorJson = (mensaje: string, status: number) =>
  Response.json(
    { error: mensaje },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );

export async function POST(request: Request) {
  const sesion = await getSession();
  if (!sesion)
    return errorJson("Sesión vencida. Iniciá sesión nuevamente.", 401);
  if (sesion.claveTemporal) return errorJson("No autorizado.", 403);

  let entrada: unknown;
  try {
    const cuerpo = await request.text();
    if (cuerpo.length > 16_384)
      return errorJson("Solicitud demasiado grande.", 413);
    entrada = JSON.parse(cuerpo);
  } catch {
    return errorJson("Solicitud inválida.", 400);
  }
  const cab = cabecera.safeParse(entrada);
  if (!cab.success) return errorJson("Solicitud inválida.", 400);
  const { tipoReporte, formato, huella } = cab.data;
  const definicion = obtenerDefinicionReporte(tipoReporte);
  if (!definicion?.rolesPermitidos.includes(sesion.rol as "ADMIN" | "MEDICO")) {
    return errorJson("No autorizado para este reporte.", 403);
  }
  const filtrosValidos = esquemas[tipoReporte].safeParse(cab.data.filtros);
  if (!filtrosValidos.success) return errorJson("Filtros inválidos.", 400);
  const filtros = filtrosValidos.data;
  if (filtros.desde > filtros.hasta)
    return errorJson("El período es inválido.", 400);

  try {
    const ahora = new Date();
    let modelo;
    let huellaActual: string;
    if (tipoReporte === "asistencia_recordatorios") {
      const f = esquemas.asistencia_recordatorios.parse(filtros);
      const datos = await consultarReporteAsistencia(f, {
        usuarioId: sesion.usuarioId,
        rol: sesion.rol as "ADMIN" | "MEDICO",
      });
      huellaActual = huellaReporte(datos);
      modelo = proyectarAsistencia(
        datos,
        {
          ...f,
          medicoId: sesion.rol === "MEDICO" ? sesion.usuarioId : f.medicoId,
        },
        ahora,
      );
    } else if (tipoReporte === "turnos_ocupacion") {
      const f = esquemas.turnos_ocupacion.parse(filtros);
      const datos = await consultarReporteOcupacion(f, {
        usuarioId: sesion.usuarioId,
        rol: sesion.rol as "ADMIN" | "MEDICO",
      });
      huellaActual = huellaReporte(datos);
      modelo = proyectarOcupacion(
        datos,
        {
          ...f,
          medicoId: sesion.rol === "MEDICO" ? sesion.usuarioId : f.medicoId,
        },
        ahora,
      );
    } else if (tipoReporte === "inventario") {
      const f = esquemas.inventario.parse(filtros);
      const datos = await consultarReporteInventario(f);
      huellaActual = huellaReporte(datos);
      modelo = proyectarInventario(datos, f, ahora);
    } else {
      const f = esquemas.cobros_cobertura.parse(filtros);
      const datos = await consultarReporteCobertura(f);
      huellaActual = huellaReporte(datos);
      modelo = proyectarCobertura(datos, f, ahora);
    }
    if (huellaActual !== huella) {
      return errorJson(
        "Los datos cambiaron desde la última consulta. Volvé a aplicar los filtros antes de descargar.",
        409,
      );
    }
    const archivo =
      formato === "pdf" ? await generarPdf(modelo) : await generarXlsx(modelo);
    const nombre = `reporte-${tipoReporte}-${filtros.desde}-${filtros.hasta}.${formato}`;
    return new Response(new Uint8Array(archivo), {
      headers: {
        "Content-Type":
          formato === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nombre}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[exportarReporte] Error:", error);
    return errorJson("No se pudo generar el reporte.", 500);
  }
}
