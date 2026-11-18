# Guía operativa - Plan de demo SIGSAM Sprint 3

> **Estado:** validada localmente contra la aplicación real el 17/11/2026.  
> **Alcance:** demo compartida del Sprint 3 en Vercel.  
> **Importante:** la suite E2E no forma parte de este PR; se mantiene en un PR separado.  
> **Fuera de Git:** `.env`, resultados de tests y capturas.

---

## 1. Preparación del entorno

### 1.1 Requisitos

- Node.js y npm instalados.
- `DATABASE_URL` y `DIRECT_URL` configuradas en `.env` (base PostgreSQL/Supabase del proyecto).
- `CRON_SECRET` configurada en `.env`. Para esta demo:

```env
CRON_SECRET=clave_de_prueba_123
```

- La demo compartida se ejecuta en `https://sistema-sala-medica.vercel.app`.

### 1.2 Preparación de los datos

La demo es **compartida**: todos usan la misma base y la misma URL de Vercel. El seed lo ejecuta **una sola persona** (el operador), desde su máquina y con el `.env` que apunta a la base compartida.

Para el operador:

```bash
npm install
npm run db:generate
npm run demo:reset
```

`npm run demo:reset` es el único comando necesario para dejar la demo lista y se puede ejecutar todas las veces que haga falta. **No usa TRUNCATE ni borra datos ajenos**: solo elimina y recrea registros del namespace reservado de la demo:

- usuarios `s3.*@sigsam.local`
- personas, obras sociales, vacunas y especialidades terminadas en ` (S3)`
- lotes que empiezan con `S3-`
- pacientes con DNI `990001xx` / nombre ` (S3)`
- turnos, consultas, correcciones, movimientos, avisos y eventos derivados de esos registros

El script imprime la base destino, las cuentas, los turnos D1/D6, el turno del cron y los IDs internos de los pacientes. Guardá esos IDs si vas a demostrar el acceso indebido del Esc 4.

Para el resto del equipo no hace falta instalar nada: solo necesitan la URL de Vercel y las cuentas de la sección 1.3.

> **Regla de oro:** el seed se corre **10–15 minutos antes** de la demo, una sola vez. Nadie más lo ejecuta durante la demo.

### 1.3 Cuentas de demo

Todas las cuentas usan la contraseña **`12345678`** y no tienen cambio de clave obligatorio.

| Rol | Correo | Nombre |
|---|---|---|
| Administrador | `s3.admin1@sigsam.local` | Administrador Demo (S3) |
| Médico 1 | `s3.medico1@sigsam.local` | Dra. Valeria Ruiz (S3) |
| Médico 2 | `s3.medico2@sigsam.local` | Dr. Hernán Salas (S3) |
| Enfermería | `s3.enfermeria1@sigsam.local` | Paula Medina (S3) |
| Paciente 1 | `s3.paciente1@sigsam.local` | Juan Pérez (S3) |
| Paciente 2 | `s3.paciente2@sigsam.local` | Elena Díaz (S3) |
| Paciente 3 | `s3.paciente3@sigsam.local` | Ana Torres (S3) |
| Tutora | `s3.tutor1@sigsam.local` | María González (S3) |

> Los nombres llevan `(S3)` a propósito: así se distingue la demo de los datos de QA existentes y el reset puede borrar solo lo propio.

### 1.4 Demo compartida en Vercel

La app de producción debe usar la **misma base** que el operador del seed. En **Vercel → Project Settings → Environment Variables** (Production):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | URL pooler de la base compartida |
| `DIRECT_URL` | URL directa de la misma base |
| `CRON_SECRET` | El mismo secreto que usa el operador |
| `APP_URL` | `https://sistema-sala-medica.vercel.app` |
| `EMAIL_OVERRIDE_TO` | Correo controlado para la demo |
| `SMTP_*` | Solo si se van a enviar mails reales |

Verificación del deploy:

```text
GET https://sistema-sala-medica.vercel.app/login → 200
GET https://sistema-sala-medica.vercel.app/api/cron/recordatorios → 401
GET https://sistema-sala-medica.vercel.app/api/cron/recordatorios con Bearer → 200
```

Si el endpoint devuelve `307`, el deploy no tiene el cambio de `src/proxy.ts`.

Runbook:

| Momento | Acción |
|---|---|
| T-30 min | Confirmar deploy de Production y variables de Vercel. |
| T-15 min | El operador corre `npm run demo:reset` contra la base compartida. |
| T-10 min | Todos cierran sesión y vuelven a entrar. Smoke test de los 5 roles. |
| T-0 | Empieza la demo con esta guía. |
| Durante | Nadie corre el seed ni la suite E2E. |
| Si falla | Se detiene, se vuelve a correr el seed y se reinicia desde el Esc 1. |

> Si alguien estaba logueado antes del reset, su cookie apunta a un usuario que ya no existe. **Cerrar sesión y volver a entrar es obligatorio.**

### 1.5 Cron de recordatorios

El cron quedó configurado **una vez al día** en `vercel.json` (`0 0 * * *`, 21:00 de Argentina), porque el plan de Vercel no habilita crons horarios. El endpoint exige:

```http
Authorization: Bearer <CRON_SECRET>
```

Para dispararlo manualmente durante la demo:

```powershell
Invoke-RestMethod `
  -Uri "https://sistema-sala-medica.vercel.app/api/cron/recordatorios" `
  -Headers @{ Authorization = "Bearer clave_de_prueba_123" }
```

Respuesta esperada: `{ exito: true, mensaje: "Recordatorios procesados" }`.

> El seed ya deja generado el recordatorio de Juan (D6) para que el Esc 6 se pueda mostrar sin depender del cron. El cron se valida además con el turno de María, que el seed deja **sin** recordatorio.

---

## 2. Escenarios

### Esc 1 — Registrar consulta médica y paso automático a Atendido

- **US:** US-SIG-017, US-SIG-016, BUG-011.
- **Usuario:** `s3.medico1@sigsam.local`.
- **Ruta:** menú **Agenda** (`/medico`) → abrir la cita de hoy de **Juan Pérez (S3)** cuya hora ya comenzó → **Abrir ficha**.
- **Datos:** en **Diagnóstico *** escribir `Control de rutina (S3).`; en **Indicaciones y pautas de alarma (opcional)** escribir `Control en 30 días. Signos de alarma explicados (S3).`
- **Botón:** **Registrar consulta**.
- **Resultado esperado:**
  1. Si se intenta guardar con diagnóstico vacío, aparece `El diagnóstico es obligatorio para registrar la consulta médica.`
  2. Al guardar, aparece **Atención registrada** y `Consulta médica registrada con éxito.`
  3. La ficha pasa a **Consulta clínica registrada** y el resultado de la cita queda **Atendido**.
  4. En base queda **una sola** consulta para ese turno.

---

### Esc 2 — Registrar ausencia en una cita finalizada

- **US:** US-SIG-016.
- **Usuario:** `s3.medico1@sigsam.local`.
- **Ruta:** **Agenda** (`/medico`) → cita de **ayer 09:00** de **Juan Pérez (S3)** → **Abrir ficha**.
- **Botón:** **Registrar ausencia** → en el modal, **Registrar ausencia**.
- **Resultado esperado:** `Ausencia registrada. La reserva se conserva con el resultado Ausente.` La ficha muestra que no se puede registrar consulta porque la cita fue marcada ausente.
- **Prueba negativa:** abrir la cita de hoy de Juan que todavía no terminó. El botón de ausencia no se habilita y se explica: `La ausencia se registra cuando termina el turno (HH:MM hs).`
- **Aclaración:** una cita pasada **no** se marca ausente automáticamente; la ausencia es una acción explícita.

---

### Esc 3 — Corrección sin duplicados en el historial

- **US:** US-SIG-018, BUG-012.
- **Usuario:** `s3.medico1@sigsam.local`.
- **Ruta:** menú **Correcciones** (`/medico/correcciones`) → en **Tus Consultas** elegir la consulta de **Juan Pérez (S3)** de hace 7 días.
- **Acción:** **Agregar aclaración**.
- **Datos:** intentar guardar vacío (aparece `Por favor, completá todos los campos requeridos.`). Luego:
  - **Motivo de la corrección ***: `Aclaración de demo (S3)`
  - **Texto de la aclaración ***: `Se amplía la indicación registrada originalmente (S3).`
- **Botón:** **Guardar aclaración** → **Aceptar y cerrar**.
- **Resultado esperado:** aparece **Aclaración agregada** y luego la corrección en **Historial de Correcciones**, asociada a la consulta original, con autor y fecha. En base **no se crea una consulta nueva**: solo una fila de corrección.

---

### Esc 4 — Historial clínico de un menor representado por su tutora

- **US:** US-SIG-020.
- **Usuario:** `s3.tutor1@sigsam.local`.
- **Ruta:** menú **Mi historia** (`/paciente/historial`).
- **Datos:** en **Seleccionar paciente** elegir **Tomás González (S3) — Menor a cargo**.
- **Resultado esperado:**
  1. La vista muestra **Paciente representado**, el aviso **Solo lectura**, la pestaña **Consultas médicas (1)** y la consulta `Control pediátrico… (S3)`.
  2. Se pueden aplicar filtros **Desde**, **Hasta** y **Especialidad**; no hay acciones de edición.
  3. **Prueba negativa:** abrir `/paciente/historial?beneficiario=<ID_DE_LUCÍA>` (el ID lo imprime el seed). La respuesta es **404**. La tutora no puede ver el historial de una paciente no vinculada.

---

### Esc 5 — Conservar la cita si falla la reprogramación y reprogramar en horario libre

- **US:** US-SIG-015.
- **Usuario:** `s3.admin1@sigsam.local`.
- **Ruta:** menú **Jornadas** (`/admin/jornadas`) → sección **Citas pendientes de resolución**.
- **Cita a usar:** la de **Lucía Fernández (S3)** en la jornada suspendida de **Dr. Hernán Salas** (mañana, 09:20).
- **Acción:** **Reprogramar**.
- **Datos:**
  - **Médico:** `Dra. Valeria Ruiz (S3)`.
  - **Fecha:** dos días después de hoy (la que corresponde al bloque de 10:00 a 12:00 creado por el seed).
  - **Buscar jornada publicada**.
  - En **Hora** verificar que **10:00 hs NO aparece** (está ocupado por Pedro Gómez) y que **10:20 hs sí aparece**.
  - Elegir **10:20 hs**.
- **Botón:** **Confirmar nuevo turno**.
- **Resultado esperado:**
  1. El modal se cierra y Lucía deja de figurar en **Citas pendientes de resolución**.
  2. Se crea un turno **Confirmado** con Dra. Ruiz a las 10:20 y se conserva la cobertura histórica de Lucía.
  3. La cita original de Lucía queda **Cancelada**, con motivo de reprogramación. No se pierde ni se altera el turno original si la operación falla.
- **Corrección respecto del plan original:** la UI **no ofrece** el horario ocupado, por lo que no se puede “hacer clic en 10:00”. La evidencia de la regla es que 10:00 no aparece en la lista y que el servidor rechaza un intento concurrente con `Ese horario ya no está disponible. Elegí otro.`

---

### Esc 6 — Recordatorio de 24 h y exclusión de cancelados

- **US:** US-SIG-032.
- **Usuario:** `s3.paciente1@sigsam.local`.
- **Ruta:** menú **Avisos** (`/paciente/avisos`).
- **Resultado esperado:** aparece un aviso **Recordatorio de turno** con la prestación `Clínica Médica (S3)`, fecha y hora. No incluye diagnóstico ni datos clínicos.
- **Cron real:** ejecutar el comando de la sección 1.5. Luego entrar como `s3.tutor1@sigsam.local` en **Avisos**: debe aparecer el recordatorio del turno de María (el seed lo deja sin aviso para que lo genere el cron).
- **Deduplicación:** ejecutar el cron dos veces. Debe seguir habiendo **un solo** aviso y **un solo** `EventoEmail` por turno.
- **Cancelados:** la cita cancelada de **Carlos Ríos (S3)** no genera recordatorio.
- **Corrección técnica:** el cron anterior comparaba `Turno.hora` (`time`) con un timestamp y fallaba en PostgreSQL. Ahora filtra por día de disponibilidad y resuelve fecha+hora en JS con la zona `America/Argentina/Buenos_Aires`. Como Vercel ejecuta el cron una vez al día, procesa **hoy y mañana** y excluye los turnos ya iniciados, para no perder los turnos de la tarde siguiente. También se restauró la autenticación por `CRON_SECRET` y se habilitó `/api/cron/*` en el proxy.

---

### Esc 7 — Crear, buscar y unicidad de obras sociales

- **US:** US-SIG-041.
- **Usuario:** `s3.admin1@sigsam.local`.
- **Ruta:** menú **Obras sociales** (`/admin/obras-sociales`).
- **Datos:**
  1. **Nueva obra social o prepaga**: `Swiss Medical (S3)` → **Agregar**. Esperado: `Operación completada` y la entidad **Activa**.
  2. Intentar crear `  swiss medical (s3)  ` → **Agregar**. Esperado: `Ya existe una obra social con ese nombre.` (trim + comparación sin distinguir mayúsculas).
  3. Buscar `OSDE` en **Buscar obra social o prepaga (CA1)** y filtrar por **Solo activas**. La tabla debe mostrar OSDE y no Accord (inactiva).
  4. Editar **IOMA (S3)** con **Editar**, cambiar el nombre a `IOMA Demo (S3)` y guardar. El id y las afiliaciones se conservan.
- **Resultado esperado:** la edición no duplica la entidad ni pierde relaciones. No hay botón **Eliminar** (baja lógica).
- **Roles:** Paciente, Médico y Enfermería no pueden acceder al ABM; `/admin/obras-sociales` los redirige a **Sin permiso**.
- **Corrección respecto del plan:** no prometer visualización de autor/fecha ni pantalla de auditoría; US-039 está fuera de alcance.

---

### Esc 8 — Desactivar y reactivar una obra social conservando el histórico

- **US:** US-SIG-041.
- **Usuario:** `s3.admin1@sigsam.local`.
- **Ruta:** **Obras sociales** (`/admin/obras-sociales`).
- **Datos:** en la fila **OSDE (S3)** → **Desactivar** → modal **Confirmar desactivación**.
- **Resultado esperado:**
  1. OSDE pasa a **Inactiva**.
  2. **Juan Pérez (S3)** conserva su obra social, plan `210` y número de afiliado.
  3. Su cita confirmada conserva la copia `OSDE (S3)`, sigue **Confirmada** y no se convierte en Particular ni se cancela.
  4. Al entrar como `s3.paciente1@sigsam.local` en **Mi cobertura**, se ve el sufijo `(obra social inactiva: no admite nuevas reservas con cobertura)`.
  5. Volver a Administración y pulsar **Activar** en OSDE. Vuelve a estar disponible.
- **Resultado esperado adicional:** no existe opción de borrado físico.

---

### Esc 9 — Registrar/actualizar la cobertura de un beneficiario

- **US:** US-SIG-028.
- **Usuario:** `s3.paciente1@sigsam.local`.
- **Ruta:** menú **Mi cobertura** (`/paciente/cobertura`).
- **Datos:**
  1. Elegir **Sin obra social** → **Guardar cobertura**. Esperado: `Cobertura retirada: el paciente queda como particular.`
  2. Elegir **OSDE (S3)**, dejar **Plan** y **Número de afiliado** vacíos → **Guardar cobertura**. Esperado: `Para registrar una obra social completá el plan y el número de afiliado.`
  3. Completar **Plan** `210`, **Número de afiliado** `S3-OSDE-001` → **Guardar cobertura**. Esperado: `Cobertura registrada con éxito.` y el resumen `Cobertura registrada: OSDE (S3) · Plan 210 · Afiliado S3-OSDE-001`.
- **Resultado esperado:** la cobertura exige los tres datos cuando hay obra social; **Sin obra social** es una opción válida y no pertenece al catálogo.

---

### Esc 10 — Reservar con cobertura vs. Particular y bloquear una obra social inactiva

- **US:** US-SIG-028.
- **Usuarios:**
  - `s3.paciente2@sigsam.local` (Elena Díaz) para la reserva con cobertura.
  - `s3.paciente3@sigsam.local` (Ana Torres) para la prueba con la obra social ya inactiva.
- **Ruta:** menú **Buscar turno** (`/paciente/buscar`).
- **Datos de la primera reserva:**
  - **Beneficiario:** `Elena Díaz (S3) · Titular`.
  - **Especialidad:** `Clínica Médica (S3)`.
  - **Profesional:** `Dra. Valeria Ruiz (S3)`.
  - **Fecha desde:** dos días después de hoy.
  - **Buscar horarios** → elegir el día disponible → horario **10:40**.
  - **Reservar este turno** → **Reservar por 5 minutos** → modal **Confirmar turno definitivamente** → **Con cobertura registrada** → **Confirmar definitivamente**.
- **Resultado esperado:** `¡Turno confirmado!`; el turno guarda modalidad `CON_COBERTURA` y las copias de la obra social, plan y afiliado.
- **Segunda parte:** como Administración, desactivar la obra social de Elena/Ana (IOMA; si se renombró en el Esc 7, `IOMA Demo (S3)`). Luego, como `s3.paciente3@sigsam.local`, buscar un turno con las mismas selecciones, elegir **11:00**, reservar 5 minutos y abrir el modal. El radio **Con cobertura registrada** debe estar **deshabilitado** y mostrar `La obra social está inactiva y no admite nuevas reservas con cobertura.`
- **Resultado esperado:** una obra social inactiva no permite nuevas reservas con cobertura; sí se puede reservar como Particular o actualizar la cobertura.

---

### Esc 11 — Crear vacuna y consultar existencias

- **US:** US-SIG-021.
- **Usuario:** `s3.enfermeria1@sigsam.local`.
- **Ruta:** menú **Vacunas** (`/enfermeria/vacunas`).
- **Datos:** **Nombre** `Dengue (S3)`, **Descripción (opcional)** `Vacuna demo dengue (S3).`, **Umbral mínimo inicial** `5` → **Crear vacuna**.
- **Resultado esperado:** `Vacuna creada con éxito.` La nueva vacuna aparece con **Dosis disponibles 0**; ese total no es editable a mano.
- **Duplicado:** intentar crear `  dengue (s3)  `. Esperado: `Ya existe una vacuna con ese nombre.`
- **Existencias:** en la fila **Antigripal (S3)** verificar **Dosis disponibles 13**, **Umbral mínimo 10**, **Estado de stock OK**. Pulsar **Ver lotes (2)** y comprobar los lotes `S3-ANT-2026-A` (8 dosis) y `S3-ANT-2026-B` (5 dosis).
- **Corrección:** la columna es solo **Dosis disponibles**; no existen columnas de dosis comprometidas ni la fórmula “disponible = físico − comprometido”.

---

### Esc 12 — Reglas de desactivación de una vacuna

- **US:** US-SIG-021.
- **Usuario:** `s3.enfermeria1@sigsam.local`.
- **Ruta:** **Vacunas** (`/enfermeria/vacunas`).
- **Datos:**
  1. En **Antigripal (S3)** (13 dosis), comprobar que **Desactivar** está deshabilitado y que se muestra `No se puede desactivar: tiene 13 dosis disponibles.`
  2. En **Varicela (S3)** (0 dosis), pulsar **Desactivar** y confirmar.
- **Resultado esperado:** la vacuna con stock no se desactiva; la vacuna sin dosis sí se desactiva y conserva sus lotes/movimientos históricos.
- **Corrección:** solo importan las dosis disponibles; no hay “compromisos activos” en esta regla.

---

### Esc 13 — Entrada por compra y ajuste manual con motivo

- **US:** US-SIG-026.
- **Usuario:** `s3.enfermeria1@sigsam.local`.
- **Ruta:** menú **Inventario** (`/enfermeria/inventario`).
- **Datos de compra:**
  - **Entrada por compra**.
  - **Vacuna *:** `Hepatitis B (S3)`.
  - **Lote existente *:** `S3-HEP-2026-A`.
  - **Cantidad de dosis *:** `10`.
  - **Referencia de la compra *:** `Factura S3-001`.
  - **Registrar movimiento**.
- **Resultado esperado:** `Movimiento registrado`; el lote pasa de 15 a 25 dosis.
- **Ajuste:**
  - **Ajuste**.
  - Misma vacuna y lote.
  - **Variación de dosis *:** `-2`.
  - Intentar guardar sin motivo: `Ingresá el motivo del ajuste.`
  - **Motivo del ajuste *:** `Conteo físico (S3)` → **Registrar movimiento**.
- **Resultado esperado:** el lote queda en 23 dosis; el historial muestra compra y ajuste con fecha, operador, cantidad y saldo resultante, filtrable por vacuna, lote y tipo.

---

### Esc 14 — Impedir saldos negativos y ajuste compensatorio

- **US:** US-SIG-026.
- **Usuario:** `s3.enfermeria1@sigsam.local`.
- **Ruta:** **Inventario** (`/enfermeria/inventario`).
- **Datos:**
  1. **Ajuste** sobre `Hepatitis B (S3)`, lote `S3-HEP-2026-A`, **Variación de dosis** `-100`, **Motivo del ajuste** `Prueba de saldo negativo (S3)` → **Registrar movimiento**.
  2. Esperado: `El lote S3-HEP-2026-A tiene 23 dosis: no se le pueden descontar 100.` El movimiento no se crea.
  3. Verificar que los movimientos anteriores no tienen acciones de editar/eliminar.
  4. **Ajuste** con variación `-1`, motivo `Corrección de conteo (S3)`, marcar **Este ajuste corrige un movimiento anterior del lote**, elegir el movimiento de compra en **Movimiento a corregir** y **Registrar movimiento**.
- **Resultado esperado:** se crea un **nuevo** movimiento compensatorio; el original permanece intacto. El lote queda en 22 dosis.
- **Corrección:** no existen “reservas a resolver” en esta regla.

---

### Esc 15 — Alerta de stock bajo y episodios

- **US:** US-SIG-027.
- **Usuario:** `s3.enfermeria1@sigsam.local`.
- **Ruta:** **Inventario** (`/enfermeria/inventario`).
- **Datos:**
  1. **Ajuste** sobre `Neumococo 23 (S3)`, lote `S3-NEU-2026-A`, variación `-1`, motivo `Alerta de stock (S3)` → **Registrar movimiento**. Stock: 6 → 5 (umbral 8).
  2. Verificar en **Avisos** (`/enfermeria/avisos`) el evento **Stock bajo de vacuna** con el resumen de dosis disponibles, físicas y umbral.
  3. Registrar otro ajuste `-1` con motivo `Sigue bajo el stock (S3)`. No debe aparecer un segundo aviso del mismo episodio.
  4. **Entrada por compra** de `10` dosis, referencia `Compra S3 alerta`. El stock sube a 14 y el episodio se cierra.
- **Resultado esperado:** un aviso y un email por episodio; sin avisos al paciente; al superar el umbral se cierra el episodio y un nuevo descenso puede abrir otro.
- **Corrección:** no hay dosis comprometidas ni alertas por reserva/liberación/aplicación.

---

### Esc 16 — Reporte de turnos y porcentaje de ocupación

- **US:** US-SIG-034.
- **Usuario:** `s3.admin1@sigsam.local`.
- **Ruta:** menú **Reportes** (`/admin/reportes`).
- **Filtros:** **Reporte** `Turnos asignados y ocupación de agenda`; **Desde** últimos 30 días; **Hasta** tres días después de hoy; **Médico** `Todos los médicos`; **Especialidad** `Todas las especialidades`; **Estado** `Todos`; **Modalidad** `Todas`. **Aplicar filtros**.
- **Resultado esperado:**
  - Tabla de **Ocupación** con **Ocupados / Utilizables**, **Bloqueados**, **Confirmadas**, **Canceladas**, **Atendido**, **Ausente**, **Sin registrar**.
  - La jornada suspendida de Dr. Salas suma sus cupos como **Bloqueados** y no como utilizables.
  - El porcentaje se calcula con cupos ocupados / cupos utilizables; si no hay cupos utilizables muestra **No aplica**.
  - Los resultados de atención no se suman como reservas adicionales.

---

### Esc 17 — Reporte de asistencia, ausentismo y recordatorios

- **US:** US-SIG-035.
- **Usuario:** `s3.admin1@sigsam.local`.
- **Ruta:** **Reportes** (`/admin/reportes`).
- **Filtros:** **Reporte** `Asistencia, ausencias y recordatorios`; **Desde** últimos 30 días; **Hasta** hoy. **Aplicar filtros**.
- **Resultado esperado:**
  - **Resumen de Resultados de Atención**: **Atendidos**, **Ausentes**, **Sin Registrar** y **Tasa de Asistencia** con la fórmula `Atendidos / (Atendidos + Ausentes)`.
  - **Turnos cancelados en el período** aparece como información separada.
  - **Auditoría de Recordatorios** muestra enviados, fallidos y reservas tardías.
  - Las citas futuras no se cuentan como ausentes.
- **Corrección:** no existe la categoría “pendientes administrativos por suspensión”.

---

### Esc 18 — Reporte de inventario actual e histórico

- **US:** US-SIG-036.
- **Usuario:** `s3.admin1@sigsam.local`.
- **Ruta:** **Reportes** (`/admin/reportes`).
- **Filtros iniciales:** **Reporte** `Inventario de vacunas y su evolución`; **Desde** últimos 30 días; **Hasta** hoy. **Aplicar filtros**.
- **Resultado esperado:**
  - **Existencias actuales** con **Vacuna**, **Estado**, **Umbral mínimo**, **Físico**, **Alerta** y **Lotes**.
  - **Evolución del período** con saldo inicial, entradas, ajustes y saldo final por fecha de registro.
  - **Movimientos del período** con fecha/hora, vacuna, lote, tipo, cantidad, motivo y operador.
  - No hay columnas **Comprometidas** ni **Disponible**.
- **Prueba de vacío:** en **Vacuna** elegir `Neumococo 23 (S3)` y en **Tipo (aplica al detalle)** elegir **Aplicaciones** → **Aplicar filtros**. Debe aparecer `No se encontraron movimientos en el período y filtros seleccionados.`
- **Corrección:** la etiqueta real de la UI es **Aplicaciones**; el plan hablaba de “Baja por aplicación”. El reporte muestra **Físico**, no dosis disponibles/comprometidas.

---

### Esc 19 — Prestaciones con cobertura

- **US:** US-SIG-037.
- **Usuario:** `s3.admin1@sigsam.local`.
- **Ruta:** **Reportes** (`/admin/reportes`).
- **Filtros iniciales:** **Reporte** `Prestaciones con cobertura`; **Desde** últimos 30 días; **Hasta** hoy. **Aplicar filtros**.
- **Resultado esperado:**
  - **Prestaciones atendidas** con KPIs **Particular**, **Gratuita** y **Con cobertura registrada**.
  - **Por entidad de cobertura** y **Por profesional**.
  - **Detalle de prestaciones** con fecha, paciente, profesional, prestación, categoría, cobertura y arancel de referencia.
  - **Gratuita** tiene prioridad cuando el arancel es 0.
  - No hay cobros, ingresos, pagos, facturas ni recibos.
- **Filtro por entidad:** elegir **Entidad de cobertura** `OSDE (S3)`. El filtro **Categoría** queda deshabilitado y la tabla muestra las prestaciones de esa entidad.
- **Corrección:** el nombre correcto es **Prestaciones con cobertura**, no “Reporte de Cobros y Coberturas”. No existe “Particular sin cobrar/cobrada”.

---

### Esc 20 — Exportar reportes PDF y Excel con datos y vacío

- **US:** US-SIG-038.
- **Usuario:** `s3.admin1@sigsam.local`.
- **Ruta:** **Reportes** (`/admin/reportes`).
- **Datos:** cualquier reporte con filtros aplicados, por ejemplo Asistencia con los últimos 30 días.
- **Acciones:** **Descargar PDF** y **Descargar Excel**.
- **Resultado esperado:**
  - Se descargan `reporte-<tipo>-<desde>-<hasta>.pdf` y `.xlsx`.
  - Ambos incluyen **todas las filas del conjunto filtrado**, no solo la página visible.
  - Incluyen nombre del reporte, período, filtros, fecha de generación y totales coherentes con la vista.
  - No incluyen contraseñas ni notas clínicas.
- **Prueba de vacío:** cambiar **Desde** a `2000-01-01` y **Hasta** a `2000-01-02`, **Aplicar filtros**. La vista muestra `No se encontraron citas en el período y filtros seleccionados.` y las exportaciones incluyen `Sin registros`.
- **RNF:** la descarga debe completarse en pocos segundos (RNF-01).

---

### Esc 21 — Restricciones de acceso a reportes por rol

- **US:** US-SIG-038.
- **Usuario médico:** `s3.medico1@sigsam.local`.
- **Ruta:** menú **Reportes** (`/medico/reportes`).
- **Resultado esperado:**
  - Se muestra `Estás viendo únicamente tus propios turnos.`
  - No existe filtro **Médico** ni se puede ampliar el alcance por URL.
  - Puede ver y exportar **Turnos asignados y ocupación de agenda** y **Asistencia, ausencias y recordatorios** con sus propios datos.
  - Si intenta `/admin/reportes`, es redirigido a **Sin permiso**.
- **Paciente:** `s3.paciente1@sigsam.local`; intentar `/admin/reportes` → **Sin permiso**. No accede a reportes agregados.

---

### Esc 22 — Consistencia final de Agenda del Médico y Mis Turnos

- **Usuario médico:** `s3.medico1@sigsam.local`.
- **Ruta:** menú **Agenda** (`/medico`).
- **Resultado esperado:** la cita de hoy de **Juan Pérez (S3)** figura **Confirmada** y con resultado **Atendido** después del Esc 1. La cita de ayer figura **Ausente** después del Esc 2.
- **Usuario paciente:** `s3.paciente1@sigsam.local`.
- **Ruta:** menú **Mis turnos** (`/paciente/turnos`) → **Período** `Todos`.
- **Resultado esperado:**
  - Se ven turnos **Atendido**, **Ausente** y **Confirmado**.
  - La cita de Juan que quedó pendiente por la jornada suspendida de Dr. Salas muestra **Confirmado** y el aviso `Esta cita requiere resolución: la jornada está suspendida.`
  - No se exige ni se muestra la etiqueta literal **Afectada**.
  - Las citas con cobertura conservan sus datos; la reprogramación de Lucía se puede verificar en la agenda de Dra. Ruiz / administración.

---

## 3. Anexo técnico: cambios y validación

### 3.1 Archivos principales

| Archivo | Cambio |
|---|---|
| `prisma/seed-demo.ts` | Seed aislado e idempotente de la demo. Limpia solo el namespace S3 y recrea D1-D9. |
| `package.json` | Script `demo:reset`. |
| `.gitignore` | Ignora `/e2e/demo-sprint3/` y permite versionar esta guía. |
| `src/lib/agenda/recordatorios-ventana.ts` | Ventana diaria (hoy/mañana) y combinación fecha + hora. |
| `src/lib/agenda/procesar-recordatorios.ts` | Corregido para no comparar `time` con timestamp; deduplicación de avisos. |
| `src/app/api/cron/recordatorios/route.ts` | Autenticación `Bearer CRON_SECRET` restaurada. |
| `src/proxy.ts` | `/api/cron/*` exceptuado del redirect a login. |
| `vercel.json` | Cron diario `0 0 * * *` (21:00 ART). |
| `docs/Sprint 3/Guia-plan-de-demo.md` | Esta guía. |

> La suite E2E (`e2e/demo-sprint3/`) no forma parte de este PR. Se mantiene en un PR separado para no afectar el build ni el CI.

### 3.2 Bug del cron: antes y después

**Antes:** `where.hora` comparaba `Turno.hora` (`time without time zone`) con un `Date` (timestamp). PostgreSQL respondía:

```text
ERROR: operator does not exist: time without time zone >= timestamp with time zone
```

Además la ventana era de 21–22 h y no cubría el día completo, y se había quitado la deduplicación de avisos.

**Después:**

- se filtra por `Disponibilidad.fecha` (día de sala);
- se combina fecha + hora en JS con `inicioTurno`;
- se usa una ventana diaria (hoy y mañana) que excluye los turnos ya iniciados, porque el cron de Vercel corre una sola vez al día;
- se restaura `avisoInternos: none { evento: "Recordatorio de turno" }`;
- se mantiene la deduplicación de email por `claveEvento`;
- el endpoint exige `CRON_SECRET`;
- el proxy deja pasar `/api/cron/*` para que el endpoint pueda autenticarse.

**Validación:** llamada manual al endpoint con y sin token (200/401) y recorrido manual de los escenarios críticos (Esc 1, 5, 6, 10, 15 y 20). La suite E2E se ejecutó localmente durante la implementación, pero **no forma parte de este PR**.

### 3.3 Validación local realizada

Durante la implementación se ejecutó la suite completa en local:

```text
22 passed
```

Esa suite no se versiona en este PR. La demo compartida se valida con el runbook de la sección 1.4 y el recorrido manual de los escenarios.

### 3.4 Limitaciones y observaciones

- **Vercel Hobby:** el cron quedó diario. Si el plan permite crons horarios, se puede volver a `0 * * * *`; la lógica ya soporta ejecuciones repetidas sin duplicar avisos.
- **Esc 5:** el horario ocupado no se ofrece en la UI; la prueba negativa se hace por ausencia en la lista y por la regla del servidor.
- **Esc 10:** se usan Elena y Ana porque Juan ya tiene turnos de la misma especialidad y la UI bloquea una segunda reserva de la misma especialidad.
- **Esc 18:** la etiqueta visible es **Aplicaciones**.
- **Formulario de inventario:** conserva un texto heredado que menciona “comprometidas” en el detalle de la vacuna; los reportes y la lógica de stock usan **Físico** y **Dosis disponibles**. No afecta los escenarios, pero conviene corregir el texto en una próxima iteración.
- **Reserva temporal:** `reservarTurnoTemporal` no verifica que el paciente pertenezca al usuario logueado. Es un hallazgo de seguridad fuera del alcance de esta demo; no bloquea los escenarios.
- **Emails:** `EMAIL_OVERRIDE_TO` redirige los correos. Para la demo se validan los registros `EventoEmail`/`IntentoEmail` y la bandeja de Avisos, no la entrega real a un buzón externo.
- **Datos:** el reset es seguro para el resto de la base, pero **es destructivo para los registros S3**. No ejecutarlo contra una base que no corresponda a la demo.

---

## 4. Checklist rápido antes de la reunión

- [ ] Deploy de Production actualizado en Vercel.
- [ ] `DATABASE_URL`, `DIRECT_URL`, `CRON_SECRET` y `APP_URL` configuradas en Vercel.
- [ ] `npm install` y `npm run db:generate` en la máquina del operador.
- [ ] `npm run demo:reset` ejecutado 10–15 minutos antes, por una sola persona.
- [ ] Todos cerraron sesión y volvieron a entrar después del reset.
- [ ] Probar login de Administración, Médico, Enfermería, Paciente y Tutora en Vercel.
- [ ] Verificar `/api/cron/recordatorios`: 401 sin token y 200 con token.
- [ ] Tener a mano los IDs de pacientes que imprime el seed para el Esc 4.
- [ ] Confirmar que el cron manual responde `Recordatorios procesados`.
- [ ] Nadie ejecuta el seed ni la suite E2E durante la demo.
