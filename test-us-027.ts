import "dotenv/config";

import { prisma } from "./src/lib/db/prisma";
import { obtenerEstadoStockVacuna } from "./src/lib/vacunacion/alerta-stock";
import { evaluarYNotificarStockBajo } from "./src/lib/vacunacion/notificaciones-stock";

/**
 * Espera breve para permitir que los emails fire-and-forget se ejecuten
 * y registren sus intentos en la BD.
 */
function esperarEmails(ms = 1000): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log("=================================================");
  console.log("       SUITE DE VERIFICACIÓN — US-SIG-027       ");
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

  // ------------------------------------------------------------------
  // Limpieza inicial
  // ------------------------------------------------------------------
  await prisma.intentoEmail.deleteMany({
    where: { evento: { vacuna: { nombre: { contains: "PRUEBA-STOCK" } } } },
  });
  await prisma.eventoEmail.deleteMany({
    where: {
      tipoEvento: "ALERTA_STOCK",
      claveEvento: { startsWith: "ALERTA_STOCK:" },
    },
  });
  await prisma.avisoInterno.deleteMany({
    where: { evento: "Stock bajo de vacuna" },
  });
  await prisma.movimientoStock.deleteMany({
    where: { lote: { vacuna: { nombre: { contains: "PRUEBA-STOCK" } } } },
  });
  await prisma.loteVacuna.deleteMany({
    where: { vacuna: { nombre: { contains: "PRUEBA-STOCK" } } },
  });
  await prisma.vacuna.deleteMany({
    where: { nombre: { contains: "PRUEBA-STOCK" } },
  });
  await prisma.usuario.deleteMany({
    where: { email: { endsWith: "@prueba-stock.local" } },
  });

  // ------------------------------------------------------------------
  // Setup
  // ------------------------------------------------------------------
  const enfermera = await prisma.usuario.create({
    data: {
      email: "enfermera-prueba-stock@prueba-stock.local",
      passwordHash: "hash-falso",
      rol: "ENFERMERIA",
      activo: true,
      claveTemporal: false,
      persona: {
        create: { nombreCompleto: "Enfermera Prueba Stock" },
      },
    },
  });
  const operadorId = enfermera.id;
  console.log(
    `\n👩‍⚕️ Enfermera de prueba: ${enfermera.email} (id: ${operadorId})\n`,
  );

  // ------------------------------------------------------------------
  // Escenario 1: umbral 5, compra 10 → sin alerta
  // ------------------------------------------------------------------
  console.log("--- Escenario 1: Stock por encima del umbral (sin alerta) ---");

  const vacuna1 = await prisma.vacuna.create({
    data: {
      nombre: "PRUEBA-STOCK-A",
      descripcion: "Vacuna para pruebas de stock bajo",
      activa: true,
      umbralMinimo: 5,
      arancelActual: 0,
    },
  });
  const lote1 = await prisma.loteVacuna.create({
    data: {
      vacunaId: vacuna1.id,
      codigo: "LOTE-A-001",
      fechaVencimiento: new Date("2027-12-31"),
      utilizable: true,
    },
  });

  await prisma.movimientoStock.create({
    data: {
      loteId: lote1.id,
      registradoPor: operadorId,
      tipo: "COMPRA",
      cantidad: 10,
      motivo: "Compra inicial",
    },
  });

  const e1 = await obtenerEstadoStockVacuna(vacuna1.id);
  assert(e1?.disponibles === 10, "Disponibles = 10");
  assert(e1?.estado === "OK", "Estado OK (10 > 5)");

  const ev1 = await prisma.eventoEmail.count({
    where: {
      vacunaId: vacuna1.id,
      tipoEvento: "ALERTA_STOCK",
      claveEvento: `ALERTA_STOCK:${vacuna1.id}`,
      canceladoEn: null,
    },
  });
  assert(ev1 === 0, "Sin episodio abierto");
  const av1 = await prisma.avisoInterno.count({
    where: { usuarioId: operadorId, evento: "Stock bajo de vacuna" },
  });
  assert(av1 === 0, "Sin aviso interno");

  // ------------------------------------------------------------------
  // Escenario 2: ajuste -6 → disponibles 4 ≤ 5 → notificar
  // ------------------------------------------------------------------
  console.log("\n--- Escenario 2: Bajamos a 4 (≤ umbral 5) → debe notificar ---");

  await prisma.movimientoStock.create({
    data: {
      loteId: lote1.id,
      registradoPor: operadorId,
      tipo: "AJUSTE",
      cantidad: -6,
      motivo: "Ajuste a la baja",
    },
  });

  const e2 = await obtenerEstadoStockVacuna(vacuna1.id);
  assert(e2?.disponibles === 4, "Disponibles = 4");
  assert(e2?.estado === "BAJO", "Estado BAJO (4 ≤ 5)");

  const r2 = await evaluarYNotificarStockBajo(vacuna1.id, operadorId);
  await esperarEmails();

  assert(r2.notificado === true, "Se notificó el nuevo episodio");
  assert(r2.estado.estado === "BAJO", "Estado retornado es BAJO");

  const ev2 = await prisma.eventoEmail.count({
    where: {
      vacunaId: vacuna1.id,
      tipoEvento: "ALERTA_STOCK",
      claveEvento: `ALERTA_STOCK:${vacuna1.id}`,
      canceladoEn: null,
    },
  });
  assert(ev2 === 1, "Un episodio abierto");
  const av2 = await prisma.avisoInterno.count({
    where: { usuarioId: operadorId, evento: "Stock bajo de vacuna" },
  });
  assert(av2 >= 1, "Se creó aviso interno");

  const int2 = await prisma.intentoEmail.count({
    where: { evento: { vacunaId: vacuna1.id, tipoEvento: "ALERTA_STOCK" } },
  });
  assert(
    int2 >= 1,
    `Se registró intento de email (total: ${int2}; falla si no hay SMTP, eso es esperado)`,
  );

  // ------------------------------------------------------------------
  // Escenario 3: seguir bajo → no repetir (CA4)
  // ------------------------------------------------------------------
  console.log("\n--- Escenario 3: Seguimos bajo → no repetir aviso ---");

  await prisma.movimientoStock.create({
    data: {
      loteId: lote1.id,
      registradoPor: operadorId,
      tipo: "AJUSTE",
      cantidad: -1,
      motivo: "Otra baja",
    },
  });

  const e3 = await obtenerEstadoStockVacuna(vacuna1.id);
  assert(e3?.disponibles === 3, "Disponibles = 3");
  assert(e3?.estado === "BAJO", "Estado sigue BAJO");

  const r3 = await evaluarYNotificarStockBajo(vacuna1.id, operadorId);
  await esperarEmails();

  assert(r3.notificado === false, "No se creó episodio nuevo (notificado=false)");
  const ev3 = await prisma.eventoEmail.count({
    where: {
      vacunaId: vacuna1.id,
      tipoEvento: "ALERTA_STOCK",
      claveEvento: `ALERTA_STOCK:${vacuna1.id}`,
      canceladoEn: null,
    },
  });
  assert(ev3 === 1, "Todavía un episodio abierto");
  const av3 = await prisma.avisoInterno.count({
    where: { usuarioId: operadorId, evento: "Stock bajo de vacuna" },
  });
  assert(av3 === 1, "No se duplicó el aviso interno");

  // ------------------------------------------------------------------
  // Escenario 4: subir stock → cierra episodio
  // ------------------------------------------------------------------
  console.log("\n--- Escenario 4: Subimos a 13 → cierra episodio ---");

  await prisma.movimientoStock.create({
    data: {
      loteId: lote1.id,
      registradoPor: operadorId,
      tipo: "COMPRA",
      cantidad: 10,
      motivo: "Reabastecimiento",
    },
  });

  const e4 = await obtenerEstadoStockVacuna(vacuna1.id);
  assert(e4?.disponibles === 13, "Disponibles = 13");
  assert(e4?.estado === "OK", "Estado OK (13 > 5)");

  await evaluarYNotificarStockBajo(vacuna1.id, operadorId);
  await esperarEmails();

  const ev4 = await prisma.eventoEmail.count({
    where: {
      vacunaId: vacuna1.id,
      tipoEvento: "ALERTA_STOCK",
      claveEvento: `ALERTA_STOCK:${vacuna1.id}`,
      canceladoEn: null,
    },
  });
  assert(ev4 === 0, "Episodio cerrado");

  // ------------------------------------------------------------------
  // Escenario 5: volver a bajar → nueva alerta futura
  // ------------------------------------------------------------------
  console.log("\n--- Escenario 5: Volvemos a bajar → nueva alerta ---");

  await prisma.movimientoStock.create({
    data: {
      loteId: lote1.id,
      registradoPor: operadorId,
      tipo: "AJUSTE",
      cantidad: -8,
      motivo: "Baja para nuevo episodio",
    },
  });

  const e5 = await obtenerEstadoStockVacuna(vacuna1.id);
  assert(e5?.disponibles === 5, "Disponibles = 5");
  assert(e5?.estado === "BAJO", "Estado BAJO (5 ≤ 5)");

  const r5 = await evaluarYNotificarStockBajo(vacuna1.id, operadorId);
  await esperarEmails();

  assert(r5.notificado === true, "Se habilitó nueva alerta futura");
  const ev5 = await prisma.eventoEmail.count({
    where: {
      vacunaId: vacuna1.id,
      tipoEvento: "ALERTA_STOCK",
      claveEvento: `ALERTA_STOCK:${vacuna1.id}`,
      canceladoEn: null,
    },
  });
  assert(ev5 === 1, "Nuevo episodio abierto");
  const av5 = await prisma.avisoInterno.count({
    where: { usuarioId: operadorId, evento: "Stock bajo de vacuna" },
  });
  assert(av5 === 2, "Segundo aviso interno");

  // ------------------------------------------------------------------
  // Escenario 6: umbral 0, stock 0 → alerta
  // ------------------------------------------------------------------
  console.log("\n--- Escenario 6: Umbral 0 y stock 0 → debe alertar ---");

  const vacuna6 = await prisma.vacuna.create({
    data: {
      nombre: "PRUEBA-STOCK-B",
      descripcion: "Vacuna para pruebas de stock bajo",
      activa: true,
      umbralMinimo: 0,
      arancelActual: 0,
    },
  });
  const lote6 = await prisma.loteVacuna.create({
    data: {
      vacunaId: vacuna6.id,
      codigo: "LOTE-B-001",
      fechaVencimiento: new Date("2027-12-31"),
      utilizable: true,
    },
  });

  const e6 = await obtenerEstadoStockVacuna(vacuna6.id);
  assert(e6?.disponibles === 0, "Disponibles = 0");
  assert(e6?.estado === "BAJO", "Estado BAJO (0 ≤ 0, incluye cero dosis)");

  const r6 = await evaluarYNotificarStockBajo(vacuna6.id, operadorId);
  await esperarEmails();

  assert(r6.notificado === true, "Se notificó umbral 0 con stock 0");
  const ev6 = await prisma.eventoEmail.count({
    where: {
      vacunaId: vacuna6.id,
      tipoEvento: "ALERTA_STOCK",
      claveEvento: `ALERTA_STOCK:${vacuna6.id}`,
      canceladoEn: null,
    },
  });
  assert(ev6 === 1, "Episodio abierto para umbral 0");

  // ------------------------------------------------------------------
  // CA5: no a pacientes, sin datos de reserva
  // ------------------------------------------------------------------
  console.log("\n--- CA5: No avisos a pacientes ni datos de reservas ---");

  const avPacientes = await prisma.avisoInterno.count({
    where: { evento: "Stock bajo de vacuna", usuario: { rol: "PACIENTE" } },
  });
  assert(avPacientes === 0, "Sin avisos a pacientes");

  const avisos = await prisma.avisoInterno.findMany({
    where: { evento: "Stock bajo de vacuna" },
    select: { turnoId: true, usuarioId: true },
  });

  const sinTurno = avisos.every((a) => a.turnoId === null);
  assert(sinTurno, "Ningún aviso tiene turnoId vinculado");

  const ids = [...new Set(avisos.map((a) => a.usuarioId))];
  const dest = await prisma.usuario.findMany({
    where: { id: { in: ids }, rol: "ENFERMERIA", activo: true },
  });
  assert(
    dest.length === ids.length,
    "Todos los destinatarios son Enfermería activa",
  );

  // ------------------------------------------------------------------
  // Resumen
  // ------------------------------------------------------------------
  console.log("\n=================================================");
  console.log(` RESULTADOS: ${exitos} pasados, ${fallos} fallados.`);
  console.log("=================================================");

  if (fallos > 0) process.exit(1);
}

runTests()
  .catch((e) => {
    console.error("Error fatal:", e);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await Promise.race([
        prisma.$disconnect(),
        new Promise((r) => setTimeout(r, 3000)),
      ]);
    } catch {
      // ignorar
    }
    process.exit(0);
  });
