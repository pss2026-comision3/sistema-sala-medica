import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  generarPdf,
  generarXlsx,
} from "../src/lib/reportes/exportacion/archivos";
import type { DocumentoExportado } from "../src/lib/reportes/exportacion/modelo";

async function probar() {
  const base: DocumentoExportado = {
    titulo: "Reporte de prueba",
    periodo: { desde: "2026-11-01", hasta: "2026-11-16" },
    generadoEn: "2026-11-16T12:00:00.000Z",
    filtros: [["Médico", "7"]],
    totales: [["Citas", 35]],
    tablas: [
      {
        titulo: "Detalle",
        columnas: ["Fecha", "Paciente", "Resultado"],
        filas: Array.from({ length: 35 }, (_, i) => [
          "2026-11-16",
          i === 34 ? "=SUM(1,2)" : `Paciente ${i + 1}`,
          "ATENDIDO",
        ]),
      },
    ],
  };
  const xlsx = await generarXlsx(base);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(xlsx as unknown as Parameters<typeof libro.xlsx.load>[0]);
  const detalle = libro.getWorksheet("Detalle");
  assert.ok(detalle);
  assert.equal(detalle.rowCount, 37);
  assert.equal(detalle.getCell("B37").value, "'=SUM(1,2)");
  assert.equal(
    libro.getWorksheet("Resumen")?.getCell("B2").value,
    "2026-11-01",
  );

  const pdf = await generarPdf(base);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.length > 1000);

  const vacio: DocumentoExportado = {
    ...base,
    totales: [["Citas", 0]],
    tablas: [{ ...base.tablas[0], filas: [] }],
  };
  const libroVacio = new ExcelJS.Workbook();
  await libroVacio.xlsx.load((await generarXlsx(vacio)) as unknown as Parameters<typeof libroVacio.xlsx.load>[0]);
  assert.equal(
    libroVacio.getWorksheet("Detalle")?.getCell("A3").value,
    "Sin registros",
  );
  assert.equal((await generarPdf(vacio)).subarray(0, 5).toString(), "%PDF-");
  process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
  const { POST } = await import("../src/app/api/reportes/exportar/route");
  const sinSesion = await POST(new Request("http://localhost/api/reportes/exportar", {
    method: "POST", body: "{}", headers: { "Content-Type": "application/json" },
  }));
  assert.equal(sinSesion.status, 401);
  console.log("US-038: PDF y XLSX completos, fórmula escapada, caso vacío y 401 OK");
}

probar().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
