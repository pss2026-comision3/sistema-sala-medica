import ExcelJS from "exceljs";
export { generarPdf } from "./pdf";
import type { DocumentoExportado } from "./modelo";

function textoSeguro(valor: string | number): string | number {
  if (typeof valor === "number") return valor;
  // Excel puede evaluar texto externo como fórmula si inicia con estos signos.
  return /^[\s]*[=+\-@]/.test(valor) ? "'" + valor : valor;
}

function nombreHoja(titulo: string): string {
  return titulo.replace(/[\\/?*\[\]:]/g, "").slice(0, 31) || "Detalle";
}

export async function generarXlsx(modelo: DocumentoExportado): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = "SIGSAM";
  libro.created = new Date(modelo.generadoEn);
  const resumen = libro.addWorksheet("Resumen");
  resumen.addRow([modelo.titulo]);
  resumen.addRow(["Desde", modelo.periodo.desde]);
  resumen.addRow(["Hasta", modelo.periodo.hasta]);
  resumen.addRow(["Generado", modelo.generadoEn]);
  resumen.addRow([]);
  resumen.addRow(["Filtros"]);
  for (const [nombre, valor] of modelo.filtros)
    resumen.addRow([nombre, textoSeguro(valor)]);
  resumen.addRow([]);
  resumen.addRow(["Totales"]);
  for (const [nombre, valor] of modelo.totales)
    resumen.addRow([nombre, textoSeguro(valor)]);
  for (const nota of modelo.notas ?? []) resumen.addRow(["Nota", nota]);
  resumen.getColumn(1).width = 32;
  resumen.getColumn(2).width = 58;
  resumen.getRow(1).font = { bold: true, size: 16 };
  resumen.mergeCells("A1:B1");
  resumen.getRow(1).height = 34;
  resumen.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF183654" },
  };
  resumen.getRow(1).font = {
    bold: true,
    size: 16,
    color: { argb: "FFFFFFFF" },
  };
  resumen.eachRow((row) => {
    row.alignment = { vertical: "middle", wrapText: true };
  });

  for (const tabla of modelo.tablas) {
    const hoja = libro.addWorksheet(nombreHoja(tabla.titulo));
    hoja.addRow([tabla.titulo]);
    hoja.addRow(tabla.columnas);
    hoja.mergeCells(1, 1, 1, tabla.columnas.length);
    hoja.getRow(1).height = 32;
    hoja.getRow(2).height = 32;
    hoja.pageSetup = {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: "1:2",
    };
    hoja.getRow(1).font = { bold: true, size: 14 };
    hoja.getRow(2).font = { bold: true, color: { argb: "FFFFFFFF" } };
    hoja.getRow(2).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF24426B" },
    };
    if (tabla.filas.length === 0) hoja.addRow(["Sin registros"]);
    else for (const fila of tabla.filas) hoja.addRow(fila.map(textoSeguro));
    hoja.views = [{ state: "frozen", ySplit: 2 }];
    hoja.columns = tabla.columnas.map((col, i) => ({
      width: Math.min(
        42,
        Math.max(
          14,
          col.length + 4,
          ...tabla.filas
            .slice(0, 100)
            .map((f) => String(f[i] ?? "").length + 2),
        ),
      ),
    }));
    hoja.eachRow((row, numero) => {
      row.alignment = { vertical: "middle", wrapText: true };
      if (numero < 3) return;
      const lineas = tabla.columnas.map((_, i) =>
        Math.ceil(
          String(row.getCell(i + 1).value ?? "").length /
            Math.max(10, (hoja.getColumn(i + 1).width ?? 14) - 2),
        ),
      );
      row.height = Math.max(25, Math.max(...lineas) * 15 + 8);
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFCED7E0" } },
          bottom: { style: "thin", color: { argb: "FFCED7E0" } },
        };
        if (numero % 2)
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF2F5F8" },
          };
      });
    });
    if (tabla.filas.length) {
      hoja.autoFilter = {
        from: { row: 2, column: 1 },
        to: { row: tabla.filas.length + 2, column: tabla.columnas.length },
      };
    }
  }
  return Buffer.from(await libro.xlsx.writeBuffer());
}
