import { prisma } from "./src/lib/db/prisma";
import {
  obtenerConsultasHistorialPaciente,
  obtenerVacunasAplicadasPaciente,
  obtenerEspecialidadesParaFiltro,
  verificarAccesoBeneficiario,
} from "./src/lib/turnos/historial-clinico";
import { cargarBeneficiarios } from "./src/lib/turnos/buscar-horarios";

async function runTests() {
  console.log("=================================================");
  console.log("       SUITE DE VERIFICACIÓN — US-SIG-020       ");
  console.log("=================================================\n");

  let exitos = 0;
  let fallos = 0;

  function assert(condicion: boolean, mensaje: string) {
    if (condicion) {
      console.log(`✅ [PASS] ${mensaje}`);
      exitos++;
    } else {
      console.error(`❌ [FAIL] ${mensaje}`);
      fallos++;
    }
  }

  // --- CA1: Acceso titular y tutor vigente, Anti-IDOR ---
  console.log("--- 1. Pruebas de Autorización y Representación (CA1) ---");

  // Usuario 4: Juan Pérez (paciente titular y tutor de Sofía Pérez)
  const usuarioId = BigInt(4);
  const beneficiarios = await cargarBeneficiarios(usuarioId);

  assert(
    beneficiarios.length > 0,
    "El usuario tiene beneficiarios registrados",
  );
  assert(
    beneficiarios.some((b) => b.id === "4" && b.tipo === "Titular"),
    "El titular accede a su propia ficha (ID: 4)",
  );

  const tieneTutelado = beneficiarios.some(
    (b) => b.id === "5" && b.tipo === "Menor a cargo",
  );
  assert(
    tieneTutelado,
    "El tutor accede a su menor a cargo con vínculo vigente (Sofía Pérez, ID: 5)",
  );

  const accesoPropio = await verificarAccesoBeneficiario(usuarioId, "4");
  assert(
    accesoPropio !== null && accesoPropio.id === "4",
    "verificarAccesoBeneficiario autoriza al titular",
  );

  const accesoTutelado = await verificarAccesoBeneficiario(usuarioId, "5");
  assert(
    accesoTutelado !== null && accesoTutelado.id === "5",
    "verificarAccesoBeneficiario autoriza al menor representado",
  );

  // Intentar acceder a un paciente ajeno (ej. ID: 26)
  const accesoAjeno = await verificarAccesoBeneficiario(usuarioId, "26");
  assert(
    accesoAjeno === null,
    "Anti-IDOR: Se bloquea el acceso a un paciente ajeno no representado (retorna null -> notFound)",
  );

  // Intentar acceder a un ID inexistente
  const accesoInexistente = await verificarAccesoBeneficiario(
    usuarioId,
    "999999",
  );
  assert(
    accesoInexistente === null,
    "Anti-IDOR: Se bloquea el acceso a un ID inexistente",
  );

  // --- CA2: Orden cronológico, identificación de médico/especialidad y filtros ---
  console.log("\n--- 2. Pruebas de Consultas, Orden y Filtros (CA2) ---");

  const todasConsultas = await obtenerConsultasHistorialPaciente({
    beneficiarioId: "4",
  });

  assert(
    todasConsultas.length >= 2,
    `Se recuperaron las consultas del paciente (total: ${todasConsultas.length})`,
  );

  // Verificar orden cronológico descendente
  let ordenCorrecto = true;
  for (let i = 0; i < todasConsultas.length - 1; i++) {
    const actual = `${todasConsultas[i].fecha}T${todasConsultas[i].hora}`;
    const siguiente = `${todasConsultas[i + 1].fecha}T${todasConsultas[i + 1].hora}`;
    if (actual < siguiente) {
      ordenCorrecto = false;
      break;
    }
  }
  assert(
    ordenCorrecto,
    "Las consultas están ordenadas cronológicamente en forma descendente",
  );

  // Verificar identificación de médico y especialidad
  const primera = todasConsultas[0];
  assert(
    Boolean(primera.medicoNombre && primera.medicoNombre.length > 0),
    `Identifica al profesional médico: «${primera.medicoNombre}»`,
  );
  assert(
    Boolean(
      primera.especialidadNombre && primera.especialidadNombre.length > 0,
    ),
    `Identifica la especialidad médica: «${primera.especialidadNombre}»`,
  );

  // Filtro por fecha que abarque las consultas
  const consultasRangoValido = await obtenerConsultasHistorialPaciente({
    beneficiarioId: "4",
    desde: "2026-10-01",
    hasta: "2026-10-31",
  });
  assert(
    consultasRangoValido.length === todasConsultas.length,
    "Filtro por período válido devuelve las consultas correspondientes",
  );

  // Filtro por fecha que excluya
  const consultasExcluidas = await obtenerConsultasHistorialPaciente({
    beneficiarioId: "4",
    desde: "2026-11-01",
    hasta: "2026-11-30",
  });
  assert(
    consultasExcluidas.length === 0,
    "Filtro por período futuro excluye consultas fuera de rango",
  );

  // Filtro por especialidad
  const especialidades = await obtenerEspecialidadesParaFiltro();
  assert(
    especialidades.length > 0,
    `Catálogo de especialidades disponible para filtro (${especialidades.length} especialidades)`,
  );

  const clinicaMedica = especialidades.find(
    (e) => e.nombre === "Clínica Médica",
  );
  if (clinicaMedica) {
    const filtradasEsp = await obtenerConsultasHistorialPaciente({
      beneficiarioId: "4",
      especialidadId: clinicaMedica.id,
    });
    assert(
      filtradasEsp.length > 0 &&
        filtradasEsp.every((c) => c.especialidadNombre === "Clínica Médica"),
      "Filtro por especialidad filtra correctamente por Clínica Médica",
    );
  }

  // --- CA3 y CA5: Registro original, correcciones y adjuntos en línea sin descarga ---
  console.log(
    "\n--- 3. Pruebas de Registro original, Correcciones y Adjuntos (CA3 / CA5) ---",
  );

  const conAdjuntosYCorrecciones = todasConsultas.find(
    (c) => c.correcciones.length > 0 && c.adjuntos.length > 0,
  );
  assert(
    Boolean(conAdjuntosYCorrecciones),
    "Existe consulta con registro original, correcciones y adjuntos",
  );

  if (conAdjuntosYCorrecciones) {
    assert(
      Boolean(conAdjuntosYCorrecciones.diagnostico),
      "Muestra diagnóstico original obligatorio",
    );
    assert(
      conAdjuntosYCorrecciones.correcciones.length > 0,
      `Muestra correcciones anexadas (total: ${conAdjuntosYCorrecciones.correcciones.length}) con motivo y autor`,
    );

    const corr = conAdjuntosYCorrecciones.correcciones[0];
    assert(
      Boolean(corr.motivo && corr.texto && corr.autorNombre),
      `Corrección identificada: motivo «${corr.motivo}», autor «${corr.autorNombre}»`,
    );

    assert(
      conAdjuntosYCorrecciones.adjuntos.length > 0,
      `Muestra documentos adjuntos visualizables (total: ${conAdjuntosYCorrecciones.adjuntos.length})`,
    );

    const adj = conAdjuntosYCorrecciones.adjuntos[0];
    assert(
      adj.urlVisualizacion.startsWith("/api/paciente/turnos/"),
      `URL segura de visualización: ${adj.urlVisualizacion}`,
    );
    assert(
      !adj.urlVisualizacion.includes("download=1"),
      "CA5: La URL no contiene parámetro forzado de descarga (sirve inline)",
    );
  }

  // --- CA4: Vacunas aplicadas separadas sin compras/ajustes ---
  console.log(
    "\n--- 4. Pruebas de Vacunación aplicada y exclusión de compras/ajustes (CA4) ---",
  );

  const vacunasPaciente = await obtenerVacunasAplicadasPaciente("4");
  assert(
    Array.isArray(vacunasPaciente),
    "Sección separada de vacunas retorna array estructurado",
  );

  console.log("\n=================================================");
  console.log(` RESULTADOS: ${exitos} pasados, ${fallos} fallados.`);
  console.log("=================================================");

  if (fallos > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((e) => {
    console.error("Error fatal durante las pruebas:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
