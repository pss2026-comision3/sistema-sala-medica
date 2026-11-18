import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generarPdf } from "../src/lib/reportes/exportacion/archivos";
import type { DocumentoExportado } from "../src/lib/reportes/exportacion/modelo";

async function main() {
  const destino = process.argv[2];
  if (!destino)
    throw new Error("Indicá el directorio de salida de las muestras.");
  await mkdir(destino, { recursive: true });
  const modelos: DocumentoExportado[] = [
    {
      titulo: "Prestaciones con cobertura",
      periodo: { desde: "2026-10-01", hasta: "2026-11-17" },
      generadoEn: "2026-11-17T15:30:00Z",
      filtros: [
        ["Médico", "Todos"],
        ["Especialidad", "Todas"],
        ["Entidad de cobertura", "Todas"],
        ["Categoría", "Todas"],
      ],
      totales: [
        ["Prestaciones", 3],
        ["Particular", 2],
        ["Gratuita", 0],
        ["Con cobertura registrada", 1],
      ],
      notas: [
        "La cobertura registrada no representa un pago recibido. El arancel es solo una referencia.",
      ],
      tablas: [
        {
          titulo: "Por médico",
          columnas: [
            "Médico",
            "Especialidad",
            "Total",
            "Particular",
            "Gratuita",
            "Con cobertura",
          ],
          filas: [["Dra. Valeria Ruiz", "Clínica médica", 3, 2, 0, 1]],
        },
        {
          titulo: "Por entidad",
          columnas: ["Entidad", "Prestaciones"],
          filas: [["Obra social de ejemplo", 1]],
        },
        {
          titulo: "Detalle de prestaciones",
          columnas: [
            "Fecha",
            "Hora",
            "Paciente",
            "DNI",
            "Profesional",
            "Especialidad",
            "Prestación",
            "Categoría",
            "Cobertura",
            "Plan",
            "Arancel de referencia",
          ],
          filas: Array.from({ length: 3 }, (_, i) => [
            "2026-10-16",
            "13:49",
            "Juan Pérez",
            "30111222",
            "Dra. Valeria Ruiz",
            "Clínica médica",
            "Consulta médica",
            i === 1 ? "CON_COBERTURA" : "PARTICULAR",
            i === 1 ? "Obra social de ejemplo" : "",
            "",
            5000,
          ]),
        },
      ],
    },
  ];
  for (const [titulo, columnas] of [
    [
      "Asistencia y recordatorios",
      [
        "Fecha",
        "Hora",
        "Paciente",
        "Médico",
        "Especialidad",
        "Estado",
        "Resultado",
        "Recordatorio",
      ],
    ],
    [
      "Turnos y ocupación",
      [
        "Nombre",
        "Especialidad",
        "Cupos publicados",
        "Cupos bloqueados",
        "Cupos utilizables",
        "Cupos ocupados",
        "Ocupación",
        "Reservas confirmadas",
        "Canceladas",
        "Atendidos",
        "Ausentes",
        "Sin registrar",
      ],
    ],
    [
      "Inventario de vacunas",
      ["Fecha", "Vacuna", "Lote", "Tipo", "Cantidad", "Motivo", "Operador"],
    ],
  ] as [string, string[]][])
    modelos.push({
      ...modelos[0],
      titulo,
      tablas: [
        {
          titulo: "Detalle del período",
          columnas,
          filas: Array.from({ length: 45 }, (_, i) =>
            columnas.map((c, n) =>
              /Fecha/.test(c)
                ? "2026-11-17"
                : /Nombre|Paciente|Médico|Operador/.test(c)
                  ? "Profesional de ejemplo"
                  : /Especialidad/.test(c)
                    ? "Clínica médica"
                    : /Motivo/.test(c)
                      ? "Ajuste registrado para control del inventario del período."
                      : n > 2
                        ? i + 1
                        : "Ejemplo",
            ),
          ),
        },
        {
          titulo: "Sección sin datos",
          columnas: ["Concepto", "Cantidad"],
          filas: [],
        },
      ],
    });
  for (let i = 0; i < modelos.length; i++)
    await writeFile(
      join(destino, `reporte-${i}.pdf`),
      await generarPdf(modelos[i]),
    );
  console.log(
    "Muestras generadas: cobertura, asistencia, ocupación e inventario.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
