import PDFDocument from "pdfkit";
import type { DocumentoExportado, TablaExportada } from "./modelo";

const MARGEN = 32;
const AZUL = "#183654";
const BORDE = "#CED7E0";

function texto(valor: string | number): string {
  const etiquetas: Record<string, string> = {
    PARTICULAR: "Particular",
    GRATUITA: "Gratuita",
    CON_COBERTURA: "Con cobertura",
    CONFIRMADO: "Confirmado",
    CANCELADO: "Cancelado",
    ATENDIDO: "Atendido",
    AUSENTE: "Ausente",
    SIN_REGISTRAR: "Sin registrar",
    ENVIADO: "Enviado",
    FALLIDO: "Fallido",
    RESERVA_TARDIA: "Reserva tardía",
    SIN_RECORDATORIO: "Sin recordatorio",
    COMPRA: "Compra",
    APLICACION: "Aplicación",
    AJUSTE: "Ajuste",
  };
  const s = String(valor).replace(/\s+/g, " ").trim();
  if (!s) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.split("-").reverse().join("/");
  if (/^\d{4}-\d{2}-\d{2}T/.test(s))
    return new Date(s).toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
    });
  return etiquetas[s] ?? s;
}

/** Envuelve incluso palabras largas para conservar todo el contenido. */
function lineas(doc: PDFKit.PDFDocument, s: string, ancho: number): string[] {
  const resultado: string[] = [];
  let actual = "";
  for (const palabra of s.split(" ")) {
    if (actual && doc.widthOfString(actual + " " + palabra) > ancho) {
      resultado.push(actual);
      actual = "";
    }
    for (const caracter of (actual ? " " : "") + palabra) {
      if (actual && doc.widthOfString(actual + caracter) > ancho) {
        resultado.push(actual);
        actual = "";
      }
      actual += caracter;
    }
  }
  resultado.push(actual);
  return resultado;
}

export async function generarPdf(modelo: DocumentoExportado): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: MARGEN,
      bufferPages: true,
    });
    const partes: Buffer[] = [];
    doc.on("data", (parte: Buffer) => partes.push(parte));
    doc.on("end", () => resolve(Buffer.concat(partes)));
    doc.on("error", reject);
    const ancho = doc.page.width - MARGEN * 2;
    const limite = doc.page.height - 44;
    let y = 0;
    const escribir = (
      s: string,
      x: number,
      alto: number,
      w: number,
      size = 9,
      bold = false,
      color = AZUL,
    ) => {
      doc
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(size)
        .fillColor(color)
        .text(s, x, alto, { width: w, lineBreak: false });
    };
    const nuevaPagina = (primera = false) => {
      if (!primera) doc.addPage();
      escribir("SIGSAM  |  REPORTES", MARGEN, 24, ancho, 9, true);
      doc
        .moveTo(MARGEN, 40)
        .lineTo(MARGEN + ancho, 40)
        .strokeColor(BORDE)
        .stroke();
      escribir(modelo.titulo, MARGEN, 51, ancho, primera ? 18 : 13, true);
      escribir(
        `Período: ${texto(modelo.periodo.desde)} al ${texto(modelo.periodo.hasta)}`,
        MARGEN,
        78,
        ancho / 2,
        9,
      );
      escribir(
        `Emisión: ${texto(modelo.generadoEn)} (Argentina)`,
        MARGEN + ancho / 2,
        78,
        ancho / 2,
        9,
      );
      y = 101;
    };
    const espacio = (alto: number) => {
      if (y + alto > limite) nuevaPagina();
    };
    nuevaPagina(true);

    const pares = (
      titulo: string,
      datos: [string, string | number][],
      destacar = false,
    ) => {
      espacio(45);
      escribir(titulo, MARGEN, y, ancho, 10, true);
      y += 19;
      for (let i = 0; i < datos.length; i += 3) {
        const grupo = datos.slice(i, i + 3);
        doc.font("Helvetica").fontSize(9);
        const contenido = grupo.map(([k, v]) =>
          lineas(doc, `${k}: ${texto(v)}`, ancho / 3 - 20),
        );
        const alto = Math.max(...contenido.map((l) => l.length)) * 12 + 12;
        espacio(alto);
        doc.rect(MARGEN, y, ancho, alto).fill(destacar ? "#F4EFCF" : "#F1F5F8");
        contenido.forEach((ls, col) =>
          ls.forEach((l, j) =>
            escribir(
              l,
              MARGEN + (col * ancho) / 3 + 8,
              y + 6 + j * 12,
              ancho / 3 - 16,
              9,
            ),
          ),
        );
        y += alto;
      }
      y += 15;
    };
    pares("Filtros aplicados", modelo.filtros);
    pares("Resumen del reporte", modelo.totales, true);
    for (const nota of modelo.notas ?? []) {
      doc.font("Helvetica").fontSize(8);
      for (const l of lineas(doc, nota, ancho)) {
        espacio(12);
        escribir(l, MARGEN, y, ancho, 8, false, "#526274");
        y += 12;
      }
      y += 10;
    }

    const tabla = (t: TablaExportada) => {
      const size = t.columnas.length > 8 ? 7.5 : 9;
      const pesos = t.columnas.map((c) =>
        /Paciente|Médico|Profesional|Especialidad|Motivo|Cobertura|Entidad|Vacuna|Nombre/.test(
          c,
        )
          ? 1.5
          : /Hora|DNI|Total|Cantidad/.test(c)
            ? 0.8
            : 1,
      );
      const suma = pesos.reduce((a, b) => a + b, 0);
      const widths = pesos.map((p) => (ancho * p) / suma);
      doc.font("Helvetica-Bold").fontSize(size);
      const heads = t.columnas.map((c, i) => lineas(doc, c, widths[i] - 10));
      const alturaCab = Math.max(...heads.map((h) => h.length)) * 11 + 12;
      const cabecera = (continuacion = false) => {
        espacio(24 + alturaCab + 25);
        escribir(
          t.titulo + (continuacion ? " (continuación)" : ""),
          MARGEN,
          y,
          ancho,
          11,
          true,
        );
        y += 22;
        doc.rect(MARGEN, y, ancho, alturaCab).fill(AZUL);
        let x = MARGEN;
        heads.forEach((ls, i) => {
          ls.forEach((l, j) =>
            escribir(
              l,
              x + 5,
              y + 6 + j * 11,
              widths[i] - 10,
              size,
              true,
              "#FFFFFF",
            ),
          );
          x += widths[i];
        });
        y += alturaCab;
      };
      cabecera();
      const filas = t.filas.length
        ? t.filas
        : [["Sin registros", ...t.columnas.slice(1).map(() => "")]];
      filas.forEach((fila, indice) => {
        doc.font("Helvetica").fontSize(size);
        const celdas = t.columnas.map((c, i) => {
          const v = fila[i] ?? "";
          const s =
            /Arancel/.test(c) && typeof v === "number"
              ? v.toLocaleString("es-AR", {
                  style: "currency",
                  currency: "ARS",
                })
              : texto(v);
          return lineas(doc, s, widths[i] - 10);
        });
        let offset = 0;
        const max = Math.max(...celdas.map((c) => c.length));
        const altoCompleto = max * 11 + 10 + (indice === filas.length - 1 ? 24 : 0);
        if (y + altoCompleto > limite && altoCompleto <= limite - 123 - alturaCab) {
          nuevaPagina();
          cabecera(true);
        }
        while (offset < max) {
          if (limite - y < 25) {
            nuevaPagina();
            cabecera(true);
          }
          const cantidad = Math.min(
            max - offset,
            Math.floor((limite - y - 10) / 11),
          );
          const alto = cantidad * 11 + 10;
          let x = MARGEN;
          celdas.forEach((ls, i) => {
            doc
              .rect(x, y, widths[i], alto)
              .fillAndStroke(indice % 2 ? "#FFFFFF" : "#F2F5F8", BORDE);
            ls.slice(offset, offset + cantidad).forEach((l, j) =>
              escribir(
                l,
                x + 5,
                y + 5 + j * 11,
                widths[i] - 10,
                size,
                false,
                "#253447",
              ),
            );
            x += widths[i];
          });
          y += alto;
          offset += cantidad;
          if (offset < max) {
            nuevaPagina();
            cabecera(true);
          }
        }
      });
      espacio(24);
      doc.rect(MARGEN, y, ancho, 22).fill("#F4EFCF");
      escribir(
        `Total de registros: ${t.filas.length}`,
        MARGEN + 7,
        y + 6,
        ancho - 14,
        9,
        true,
      );
      y += 40;
    };
    for (const t of modelo.tablas) tabla(t);
    const paginas = doc.bufferedPageRange();
    for (let i = 0; i < paginas.count; i++) {
      doc.switchToPage(i);
      // El pie está fuera del margen del cuerpo; evitar que PDFKit agregue otra página.
      const margenInferior = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .moveTo(MARGEN, doc.page.height - 31)
        .lineTo(MARGEN + ancho, doc.page.height - 31)
        .strokeColor(BORDE)
        .stroke();
      escribir(
        "SIGSAM · Uso autorizado",
        MARGEN,
        doc.page.height - 24,
        ancho / 2,
        8,
      );
      escribir(
        `Página ${i + 1} de ${paginas.count}`,
        MARGEN + ancho - 90,
        doc.page.height - 24,
        90,
        8,
      );
      doc.page.margins.bottom = margenInferior;
    }
    doc.end();
  });
}
