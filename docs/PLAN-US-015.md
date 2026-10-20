# US-SIG-015 — Gestionar solicitudes presenciales y reprogramaciones

Este archivo documenta la historia completa y el estado real de su implementación (rama `feature/us-015-gestionar-solicitudes-presenciales`, creada a partir de `feature/us-009-suspender-jornada`). A diferencia de `PLAN-US-001.md`, `PLAN-US-006.md`, `PLAN-US-007.md` y `PLAN-US-013.md` (planes escritos *antes* de implementar), este se escribió *después*, como registro de lo que se hizo y lo que quedó pendiente.

---

## 1. Historia de usuario completa

**US-SIG-015 — Gestionar solicitudes presenciales y reprogramaciones**

> Como integrante del personal autorizado, quiero registrar reservas y resolver citas que requieren intervención, para ayudar al paciente y gestionar los imprevistos de la sala.

Preguntas relacionadas: P-11, P-20, P-21, P-22, P-23, P-24, P-26, P-27, P-37, P-39.

### Criterios de aceptación

- **CA1.** Médicos, Enfermería y Administración pueden reservar citas médicas o vacunación para registros Paciente existentes y habilitados.
- **CA2.** El personal autorizado puede reservar o cancelar hasta antes del inicio, registrando solicitud y operador. Se respetan cupos, límites por paciente, superposiciones y compromisos de vacunas.
- **CA3.** Administración resuelve individualmente las citas médicas de jornadas suspendidas, cancelándolas con motivo o registrando un nuevo horario de la misma especialidad, acordado con el paciente fuera del sistema.
- **CA4.** Reprogramar una cita médica confirma el nuevo cupo y cancela el anterior como una operación conjunta. El turno reemplazado se excluye del límite de esa especialidad; si el nuevo no puede obtenerse, se conserva el original.
- **CA5.** Enfermería o administración puede cancelar vacunas por solicitud presencial. Enfermería resuelve una agenda de vacunación suspendida cancelando y reservando nuevamente; no se ofrece reprogramación automática de dosis.
- **CA6.** Una cita suspendida puede resolverse después de su horario si no tiene atención registrada. No se cancelan consultas realizadas ni aplicaciones; se conservan los motivos y se generan los avisos correspondientes.

**Inferencias de la US:** la excepción presencial al plazo de 24 horas permite resolver solicitudes tardías. La reprogramación médica exige acuerdo previo y no modifica silenciosamente un horario confirmado.

### Dependencia documentada

[docs/Distribucion de USs por Sprint.md:125-129](<Distribucion de USs por Sprint.md>) marca explícitamente, en el diagrama de flujo del Sprint 2, la flecha `US-009 (Suspender Jornada) → US-015 (Gestión Presencial)`. Esto se confirma en el código: `src/app/actions/suspension.ts` (US-009) deja dicho en su propio comentario que "la resolución individual es de US-015", y `src/app/(app)/admin/jornadas/page.tsx` dice lo mismo en su docstring. Por eso esta US se ramificó desde `feature/us-009-suspender-jornada` y no desde `main`/`stage`.

---

## 2. Alcance implementado vs. diferido

| CA | Cubre | Estado |
| --- | --- | --- |
| CA3 | Cancelar con motivo una cita confirmada de una jornada suspendida | ✅ Implementado |
| CA4 | Reprogramar (confirma el nuevo cupo y cancela el anterior en una transacción) | ✅ Implementado, solo citas **médicas** |
| CA6 | Resolver después del horario; no tocar consultas ya atendidas/ausentes | ✅ Implementado |
| CA1 | Reservar una cita **médica** para un paciente existente | ✅ Implementado |
| CA2 | Cancelar/reservar **citas médicas** hasta antes del inicio, cupos, límite por especialidad, operador registrado | ✅ Implementado |
| CA1 / CA2 | La parte de **vacunación** ("cita... de vacunación", "compromisos de vacunas") | ❌ Diferido |
| CA5 | Cancelar vacunas, resolver agenda de vacunación suspendida | ❌ Diferido por completo |

**Por qué queda afuera la vacunación:** depende de la agenda del vacunatorio (**US-SIG-022** "Ofrecer horarios del vacunatorio" y **US-SIG-023** "Reservar aplicación con cupo y dosis"), ambas del **Sprint 3** ([docs/Distribucion de USs por Sprint.md:181-182](<Distribucion de USs por Sprint.md>)). Hoy solo existe `src/lib/turnos/vacunatorio.ts`, con una única consulta de solo lectura (`obtenerTurnosVacunatorioDelDia`); no hay reserva ni cancelación real de turnos de vacunación en todo el proyecto. No es una omisión de esta US: es una dependencia cruzada entre sprints que ya existía en el plan original.

---

## 3. Decisiones de diseño y arquitectura

| Tema | Decisión |
| --- | --- |
| **Dos features, una US** | CA3/CA4/CA6 (resolver una cita ya afectada por una suspensión) y CA1/CA2 (reservar/cancelar presencial, sin relación con una suspensión) son flujos distintos en la práctica, con distinto punto de entrada. Se implementaron como dos módulos separados en vez de uno solo. |
| **Resolución (CA3/CA4/CA6) — ubicación** | Dentro de `/admin/jornadas`, debajo del panel de suspensión de US-009 (`SuspenderJornadaPanel`). Es exclusivo de Administración (CA3 dice "Administración resuelve individualmente"). |
| **Reserva presencial (CA1/CA2) — ubicación** | Ruta nueva y compartida `/turnos/presenciales`, fuera de `/admin`, porque CA1 nombra a los **tres** roles (Médico, Enfermería, Administración), no solo a Admin. Guard propio en su `layout.tsx` (no se usa `requireRole`, que exige un único rol). |
| **Reglas de resolución (CA3/CA6)** | `puedeResolverCita(turno, jornada)` en `src/lib/agenda/resolucion.ts`: exige `CONFIRMADO` + `resultado = SIN_REGISTRAR` + jornada `SUSPENDIDA`. Sin límite de 24 hs ni de "antes del inicio" (CA6 permite resolver después del horario). |
| **Regla de cancelación presencial (CA2)** | `puedeCancelarPresencial(turno, ahora)` en `src/lib/agenda/reservas.ts`: exige `CONFIRMADO` + `resultado = SIN_REGISTRAR` + que el turno no haya empezado todavía. A diferencia de `puedeCancelarTurno` (autoservicio del paciente, 24 hs), acá no hay espera: es justamente la vía presencial que `MSG.CANCELACION_PLAZO` ya le sugería al paciente ("Contactá a la sala para gestionarla presencialmente"). |
| **Citas de jornadas suspendidas en `/turnos/presenciales` (CA3)** | Aparecen en la lista de citas vigentes con la etiqueta "Jornada suspendida · la resuelve Administración en Jornadas" y sin botón Cancelar; `cancelarCitaPresencial` las rechaza (`MSG_PRESENCIAL.CITA_SUSPENDIDA`). Solo Administración las resuelve, desde `/admin/jornadas`. |
| **Reprogramación (CA4)** | Transacción única: bloquea la jornada destino (`SELECT ... FOR UPDATE`, mismo patrón que `reservarTurnoTemporal`), valida el horario nuevo (ver "Reglas de horario"), cancela el turno original (`origen_cancelacion = "reprogramacion"`) y crea el nuevo turno `CONFIRMADO` con `reprogramado_desde_id` apuntando al original. Si el horario nuevo no se puede obtener, se aborta toda la transacción y el original queda intacto (así se cumple "si el nuevo no puede obtenerse, se conserva el original"). |
| **Cómo se elige el horario (CA1/CA3/CA4)** | El operador elige médico + fecha (desde hoy) y el servidor devuelve la jornada publicada con la **lista de horarios libres** (`horariosLibresPresencial`); se elige uno de un desplegable. Es la misma grilla que ofrece el autoservicio (cada `duracionTurnoMin` desde `horaDesde`). El horario "acordado con el paciente fuera del sistema" (CA3) se elige de esa lista. |
| **Reglas de horario (CA2/CA4)** | `validarHorarioPresencial` en `src/lib/agenda/presencial.ts` (pura), compartida por la reserva y la reprogramación y aplicada dentro de la transacción. El horario tiene que (1) ser un inicio de la grilla con el turno completo dentro de la jornada, (2) no haber empezado, (3) no superponerse **por rango** con turnos del médico y (4) no superponerse con otros turnos del paciente en esa fecha (cualquier médico, jornadas publicadas; en la reprogramación no cuenta la cita original). Las retenciones vencidas no ocupan el cupo y se liberan (`liberarRetencionesVencidas`). Los datos los carga `src/lib/turnos/presencial.ts`. |
| **Creación del turno nuevo (CA1/CA4)** | Mismos campos que `reservarTurnoTemporal` (`tipo: "CONSULTA"`, `duracionMin`/`arancel` desde la configuración del médico, `modalidad: "PARTICULAR"`), pero directo a `CONFIRMADO`: la reserva presencial no necesita la retención de 5 minutos del autoservicio (CA1/CA4 no la piden). |
| **Operador registrado (CA2)** | `turno.creado_por` guarda la cuenta del Médico/Enfermería/Admin que operó, no la del paciente. Cada acción además deja una fila en `auditoria` con el rol del operador. |
| **Paciente habilitado (CA1)** | `evaluarHabilitacionPaciente` en `src/lib/agenda/presencial.ts`. Un adulto está habilitado con su propia cuenta `PACIENTE` activa (US-002 CA5); un menor, con un tutor principal vigente, es decir, adulto con cuenta `PACIENTE` activa (US-003 CA2, mismo criterio que `motivoNoPuedeSerTutor`). En la búsqueda los no habilitados aparecen marcados con el motivo: se les pueden cancelar citas, pero no reservar. |
| **Límite por especialidad (CA2/CA4)** | `buscarCitaVigenteEspecialidad` en `src/lib/turnos/presencial.ts`: misma regla que `cargarCitasVigentesEspecialidad` del autoservicio, más el estado de la jornada y una exclusión. Si la cita vigente está pendiente de resolución, el mensaje lo dice y deriva a Administración. En la reprogramación se excluye la cita reemplazada (CA4), pero cualquier otro turno vigente de la especialidad la bloquea. |
| **Avisos (CA3/CA4/CA6)** | Reutiliza `crearAvisoCancelacion` y `crearAvisoReprogramacion` de `src/lib/notificaciones/avisos.ts` (US-031). El aviso queda en `aviso_interno` y lo ve el paciente, o su tutor si es menor, en `/paciente/avisos`. Sin emails externos (regla de negocio) — ver sección 8. |
| **Vacunación fuera de alcance** | Ningún archivo nuevo toca `Vacuna`, `LoteVacuna` ni `vacunatorio.ts`. |

---

## 4. Mensajes y constantes agregadas

- `src/lib/agenda/resolucion.ts` — `MSG_RESOLUCION` (nuevo archivo): motivos, estados y textos de aviso específicos de CA3/CA4/CA6.
- `src/lib/auth/constants.ts`:
  - `MSG.CANCELACION_INICIADA`: "Esta cita ya empezó: no se puede cancelar." (CA2).
  - `AUDITORIA.RESOLUCION_CANCELACION_SUSPENSION`, `AUDITORIA.RESOLUCION_REPROGRAMACION_SUSPENSION` (CA3/CA4).
  - `AUDITORIA.RESERVA_PRESENCIAL`, `AUDITORIA.CANCELACION_PRESENCIAL` (CA1/CA2).

---

## 5. Rutas y navegación

| Ruta | Rol(es) | Qué hace |
| --- | --- | --- |
| `/admin/jornadas` (ya existía, se extendió) | ADMIN | Debajo de "Suspender jornada", nueva sección "Citas pendientes de resolución" (CA3/CA4/CA6). |
| `/turnos/presenciales` (nueva) | MEDICO, ENFERMERIA, ADMIN | Buscar paciente → reservar una cita médica, o ver sus citas vigentes y cancelar una (CA1/CA2). |

`src/components/app-shell.tsx` — se agregó el link "Turnos presenciales" a los tres roles (ADMIN, MEDICO, ENFERMERIA).

---

## 6. Árbol de archivos

### Creados

```
src/lib/agenda/resolucion.ts                       # Reglas puras CA3/CA4/CA6
src/lib/agenda/presencial.ts                       # Reglas puras de horario (grilla, superposición) y habilitación
src/lib/turnos/presencial.ts                       # Datos para esas reglas (ocupados, límite, retenciones vencidas)
src/app/actions/resolucion-citas.ts                 # Server actions: listar, cancelar, reprogramar
src/components/agenda/ResolverCitasPanel.tsx         # UI en /admin/jornadas (lista por props desde la página)

src/app/actions/reservas-presenciales.ts            # Server actions: buscar paciente, catálogo, reservar, cancelar
src/app/(app)/turnos/presenciales/layout.tsx         # Guard de los 3 roles
src/app/(app)/turnos/presenciales/page.tsx
src/components/agenda/ReservarCitaPresencialPanel.tsx
```

### Modificados

```
src/app/(app)/admin/jornadas/page.tsx     # + <ResolverCitasPanel citas hoy /> (carga las citas pendientes)
src/lib/agenda/reservas.ts                # + puedeCancelarPresencial
src/lib/auth/constants.ts                 # + MSG.CANCELACION_INICIADA, 4 claves de AUDITORIA
src/components/app-shell.tsx              # + nav "Turnos presenciales" (ADMIN/MEDICO/ENFERMERIA)
```

---

## 7. Superposición de horarios: resuelto en US-015, pendiente en US-012

La primera versión de esta US comparaba el **minuto exacto** para saber si un horario estaba ocupado, igual que `reservarTurnoTemporal` (US-012). Además, el chequeo de rango hacía `horaDesde.toString().split(":")` sobre un `Date`: `parseInt("Thu Jan 01 1970 06")` da `NaN` y la comparación nunca rechazaba nada. Eso aceptaba horas fuera de la jornada o pasadas, y turnos que terminaban después del cierre.

En `reservarCitaPresencial` y `reprogramarCitaAfectada` las dos cosas se reemplazaron por `validarHorarioPresencial` (sección 3, "Reglas de horario"): grilla, turno completo dentro de la jornada, horario futuro y solape por rango con el médico y con el paciente.

**Queda pendiente en `reservarTurnoTemporal` (US-012, autoservicio)**, que no se tocó por estar fuera del alcance de esta US: sigue con el chequeo por minuto exacto y el mismo parseo que da `NaN` (`src/app/actions/reservas.ts:86-92`). En la práctica el autoservicio solo ofrece horarios de la grilla ya filtrados por rango (`buscarHorariosEnFechas`), así que el riesgo se limita a pedidos manipulados o carreras. Se corrige reutilizando `validarHorarioPresencial` (sin la parte del paciente si no corresponde).

---

## 8. Sobre los avisos (CA3/CA4/CA6, "se generan los avisos correspondientes")

**Regla de negocio: el sistema no envía emails externos; todo aviso es interno.** Los avisos se guardan en la tabla `aviso_interno` y el destinatario los ve en su bandeja, `/paciente/avisos` (US-031).

| Acción de esta US | Función | Evento en la bandeja | Turno asociado |
| --- | --- | --- | --- |
| Cancelación presencial (CA2) | `crearAvisoCancelacion` | "Cancelación de turno" | el cancelado |
| Cancelación con motivo de una cita suspendida (CA3/CA6) | `crearAvisoCancelacion` | "Cancelación de turno" | el cancelado |
| Reprogramación (CA4) | `crearAvisoReprogramacion` | "Turno reprogramado" | el **nuevo** (para que apunte a la cita vigente) |

- El destinatario es la cuenta activa del paciente o, si es un menor sin cuenta, la de su tutor. Si no hay ninguna cuenta activa, no se crea aviso y la auditoría registra `sinDestinatario: true`.
- Ya no se escribe en `evento_email`, y los recordatorios por email dejaron de existir (`anularRecordatoriosPendientes` se eliminó en la US-031).
- Para verificar que "se avisó", entrá con la cuenta del paciente → **Avisos**, o mirá la tabla `aviso_interno` con `npm run db:studio`.

---

## 9. Verificación realizada

- `npx prettier --write`, `npx eslint` y `npx tsc --noEmit` sobre todos los archivos nuevos y modificados: sin errores.
- `npm run build` completo: pasa, incluida la ruta nueva `/turnos/presenciales` y la sección agregada en `/admin/jornadas`.
- Pruebas de lógica pura (sin base de datos, corridas con `tsx` fuera del repo):
  - 13 casos sobre `puedeResolverCita`, `validarMotivoResolucion` y el contenido de los avisos de CA3/CA4/CA6.
  - 8 casos sobre `puedeCancelarPresencial`, incluido uno que compara explícitamente contra la regla de 24 hs del autoservicio (`puedeCancelarTurno`) para confirmar que no se mezclan.
  - 38 casos sobre las correcciones posteriores:
    - grilla y turno completo dentro de la jornada;
    - horario pasado;
    - solape por rango con el médico (turno de 30 min a las 09:00 bloquea las 09:20) y con el paciente;
    - lista de horarios libres;
    - retenciones vencidas vs. vigentes;
    - habilitación (adulto activo y desactivado, sin cuenta, otro rol, menor con y sin tutor vigente, cumpleaños 18);
    - `puedeResolverCita` con una cita ya cancelada.
- `npx tsc --noEmit`, `npx eslint`, `npx prettier` y `npm run build` vuelven a pasar después de las correcciones.
- **No verificado en pantalla**: ambas pantallas dependen de datos reales (un médico con jornada suspendida y citas confirmadas, un paciente dado de alta). No se pudo mockear como la US-010; queda para probar con `npm run dev` contra la base real.

---

## 10. Casos de prueba manual (CA1 a CA6, sin vacunación)

**Preparación común:** un médico con una jornada PUBLICADA futura con al menos una cita CONFIRMADA; esa jornada suspendida desde `/admin/jornadas` (para CA3/CA4/CA6); un paciente adulto dado de alta aparte (para CA1/CA2).

### CA3 — Cancelar con motivo
1. Camino feliz: cancelar con motivo desde `/admin/jornadas` → el turno pasa a `CANCELADO`, desaparece de la lista, queda una fila en `aviso_interno` (el paciente ve "Cancelación de turno" en **Avisos**) y una fila en `auditoria`.
2. Motivo vacío → error, no cancela.
3. Dos pestañas: la misma cita cancelada en una y después en la otra → la segunda dice "Esta cita ya se resolvió o ya tiene un resultado registrado."
3b. Suspender una jornada en el panel de arriba → sus citas aparecen en "Citas pendientes de resolución" sin recargar la página.
3c. En `/turnos/presenciales` (como Médico o Enfermería), una cita de jornada suspendida aparece con la etiqueta "Jornada suspendida · la resuelve Administración en Jornadas" y sin botón Cancelar.

### CA4 — Reprogramar
4. Camino feliz, mismo médico → original `CANCELADO` (`origen_cancelacion = "reprogramacion"`), turno nuevo `CONFIRMADO` con `reprogramado_desde_id`, un aviso con fecha/hora vieja y nueva.
5. Elegir otro médico de la misma especialidad → debe aparecer en el selector (no aparecen médicos de otra especialidad).
6. Horario que se ocupa mientras tanto (otra pestaña) → error "Ese horario ya no está disponible. Elegí otro." **y el original sigue intacto**.
7. Fecha sin jornada publicada para ese médico → "La jornada elegida para reprogramar no está publicada."
7b. El desplegable de horas solo ofrece horarios de la grilla, futuros, sin solape con el médico ni con otros turnos del paciente; el selector de fecha no deja elegir días pasados.
7c. Paciente con la cita suspendida de Clínica: reservarle presencialmente otra de Clínica → "El paciente tiene una cita de esta especialidad pendiente de resolución…"; reprogramar la suspendida sí funciona.

### CA6 — Resolver después del horario / no tocar atendidas
8. Cita afectada cuya hora ya pasó → sigue resoluble (cancelar o reprogramar).
9. Cita con resultado ya registrado (ATENDIDO/AUSENTE) → no aparece en la lista; una acción directa sobre ese `turnoId` devuelve "ya se resolvió".

### CA1 — Reservar presencial
10. Camino feliz desde Admin en `/turnos/presenciales`: buscar paciente por DNI → especialidad/médico/fecha → buscar jornada → elegir hora del desplegable → confirmar → turno `CONFIRMADO`, `creado_por` = el Admin, y la cita aparece enseguida en "Cancelar una cita vigente".
11. Mismo flujo logueado como Médico.
12. Mismo flujo logueado como Enfermería.
13. Logueado como Paciente, entrar a `/turnos/presenciales` por URL → redirige a `/sin-permiso`.
14. Buscar un paciente que no existe → "No se encontraron pacientes."
14b. Paciente no habilitado (cuenta desactivada, o menor sin tutor vigente) → aparece en la búsqueda con "No habilitado: {motivo}"; al elegirlo, la sección de reserva muestra "No se puede reservar: {motivo}".

### CA2 — Cupos, límite por especialidad, antes del inicio, operador
15. Reservar un horario para un paciente y después buscar la misma jornada para otro paciente → ese horario ya no aparece en el desplegable. Si se confirma desde una pestaña vieja → "Ese horario ya no está disponible. Elegí otro."
15b. Con turnos de 20 min y uno de 30 min a las 09:00 (duración cambiada después), el horario de 09:20 no se ofrece.
15c. El último horario ofrecido es el que termina justo al cierre (jornada 09:00–12:00 de 20 min → 11:40).
15d. En la jornada de hoy, no se ofrecen horarios que ya pasaron.
15e. Paciente con un turno de Pediatría a las 10:00: al reservarle Clínica el mismo día, no se ofrecen los horarios que se superponen.
15f. Una retención del autoservicio vencida (más de 5 min sin confirmar) no bloquea el horario.
16. Paciente con un turno vigente de Clínica médica; reservarle otro de Clínica médica → error de límite por especialidad.
17. El mismo paciente sí puede tener a la vez un turno vigente de Clínica y otro de Pediatría.
18. Reservar un turno para dentro de 2 horas y cancelarlo desde `/turnos/presenciales` → lo permite (a diferencia del autoservicio del paciente).
19. Cancelar una cita cuya hora ya pasó → "Esta cita ya empezó: no se puede cancelar."
20. Revisar `turno.creado_por` y `auditoria` después de 10/11/12 → debe figurar la cuenta que operó, nunca la del paciente.
21. Suspender la jornada en una pestaña mientras en otra se intenta reservar un cupo de esa misma jornada → la reserva falla, no queda un turno confirmado en una jornada suspendida.

---

## 11. Pendiente

- Vacunación completa de CA1, CA2 y CA5 — depende de US-SIG-022 y US-SIG-023 (Sprint 3).
- `reservarTurnoTemporal` (US-012) sigue con el chequeo por minuto exacto y el parseo de rango que da `NaN` (sección 7). No es de esta US.
- Carrera del límite por especialidad: el límite se valida antes de la transacción, así que dos reservas simultáneas del mismo paciente y la misma especialidad en jornadas distintas podrían pasar las dos. Se dejó afuera por su baja probabilidad.
