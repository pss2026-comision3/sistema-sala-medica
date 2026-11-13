# Plan de implementación — US-SIG-017 Registrar una consulta médica

Este documento especifica la arquitectura, diseño, reglas de negocio y estrategia de pruebas para implementar la historia de usuario **US-SIG-017** en SIGSAM. Sigue estrictamente los estándares de `docs/PLAN-US-001.md`, `docs/PLAN-US-006.md`, `docs/PLAN-US-007.md` y `docs/PLAN-US-013.md`.

---

## 0. Qué hacer y qué no hacer

### Qué hacer:
1. **El Médico** accede a la ficha de su cita confirmada en `/medico/turnos/[id]` (ruta ya existente donde hoy figura el placeholder `[MOCK-US010]`).
2. En la ficha de la cita:
   - Se evalúan las condiciones de inicio de atención: cita propia, confirmada, jornada no suspendida, inicio del turno alcanzado y resultado `SIN_REGISTRAR` (CA1).
   - Si se cumplen las condiciones y aún no tiene consulta registrada, se disponibiliza el formulario de atención médica con:
     - **Diagnóstico** (texto multilínea, **obligatorio**, no vacío ni puros espacios).
     - **Síntomas** (texto multilínea, opcional).
     - **Indicaciones** (texto multilínea, opcional).
     - **Medicación** (texto multilínea, opcional).
     - **Estudios solicitados** (texto multilínea, opcional).
     - **Observaciones** (texto multilínea, opcional).
     - **Certificado** (texto multilínea, opcional).
   - Al guardar la consulta:
     - Se valida la sesión del profesional médico (`requireRole("MEDICO")`).
     - Se verifica que la cita le pertenezca y cumpla todas las restricciones de CA1.
     - Se persiste la consulta en la tabla `consulta` vinculada a `turno_id` y `autor_id`.
     - Se actualiza el turno: `resultado = "ATENDIDO"` y `atendido_en = now()` en la misma transacción atómica.
     - Se registra evento de auditoría con la acción `"Registro de consulta médica"`.
     - Se asegura idempotencia: una consulta por turno, intentos repetidos no la duplican (CA3).
   - Una vez guardada la consulta:
     - La ficha muestra el detalle clínico completo en modo de solo lectura para el médico autor (CA4).
     - La información clínica es inmutable: no se puede editar ni borrar desde esta pantalla (CA4).
3. **Privacidad y confidencialidad clínica (CA5):**
   - Un médico solo puede ver o registrar consultas de sus propias citas (`notFound()` si la cita no le pertenece).
   - Ningún médico puede ver consultas ni citas de otros profesionales.
   - El rol `ADMIN` no tiene acceso a las notas clínicas (es redirigido a `/sin-permiso`).
4. **Desacople y transición con US-SIG-016:**
   - La historia US-SIG-016 ("Registrar resultado real de una cita") define los resultados `SIN_REGISTRAR`, `ATENDIDO` y `AUSENTE`, y permite al médico/enfermería marcar ausencias.
   - En este plan se encapsula el cambio a `ATENDIDO` y la comprobación de ausencia en helpers modulares con comentarios `// [INTEGRACION-US016]` y mocks para pruebas, de modo que cuando el compañero suba la US-SIG-016 la integración sea inmediata y sin fricción.

### Qué no hacer:
- **No** permitir guardar una consulta sin diagnóstico (es obligatorio y debe tener contenido real).
- **No** permitir registrar consultas en citas canceladas, en jornadas suspendidas o antes de que llegue la hora de inicio de la cita.
- **No** permitir editar o borrar una consulta médica ya guardada (las aclaraciones corresponden a US-SIG-018 y los archivos adjuntos a US-SIG-019).
- **No** permitir que un médico consulte notas clínicas de pacientes de otros profesionales.
- **No** permitir que el Administrador acceda al contenido clínico.
- **No** modificar el esquema de base de datos (`prisma/schema.prisma` ya cuenta con el modelo `Consulta` y el enum `ResultadoAtencion`).
- **No** instalar dependencias adicionales.

---

## 1. Criterios de Aceptación (US-SIG-017)

> **Como** médico, **quiero** documentar la atención de un paciente desde su cita, **para** conservar el diagnóstico y las indicaciones que le proporcioné.
>
> **Preguntas relacionadas:** P-11, P-12, P-31, P-34, P-51, P-52, P-53, P-56.

- **CA1.** La consulta se registra desde una cita médica propia, confirmada, no suspendida, cuyo inicio ya ocurrió y cuyo resultado es Sin registrar.
- **CA2.** El diagnóstico es obligatorio. Se admiten síntomas, indicaciones, medicación, estudios solicitados, observaciones y texto de certificados como datos opcionales.
- **CA3.** Guardar vincula la entrada con paciente, médico y cita, registra fecha y marca Atendido. Solo existe una consulta inicial por cita y un reintento no la duplica.
- **CA4.** La entrada guardada no se sobrescribe ni elimina. Las aclaraciones se incorporan como correcciones identificadas, conservando el original.
- **CA5.** El Médico no puede escribir ni consultar notas de otros profesionales. El rol Administrador tampoco otorga acceso al contenido clínico.

---

## 2. Dependencia con US-SIG-016 y estrategia de transición

### 2.1 Análisis de la dependencia
- **US-SIG-016** gestiona el ciclo de vida del resultado de la cita:
  - Inicialmente: `resultado = SIN_REGISTRAR`.
  - Al completar la atención: pasa a `resultado = ATENDIDO` (cubierto por US-017 CA3 y US-016 CA1).
  - Si el paciente no se presenta tras el fin del turno: el profesional marca `resultado = AUSENTE` (responsabilidad directa de US-016).
  - Regla CA4 de US-016 / CA1 de US-017: No se puede registrar consulta médica sobre una cita con ausencia vigente o ya atendida.

### 2.2 Estado actual del repositorio
- El modelo `Turno` en `prisma/schema.prisma` ya define:
  ```prisma
  resultado  ResultadoAtencion  @default(SIN_REGISTRAR)
  atendidoEn DateTime?          @map("atendido_en")
  consulta   Consulta?
  ```
- Por lo tanto, a nivel de base de datos **no hay impedimento técnico**: las columnas y enums existen en PostgreSQL.

### 2.3 Solución para trabajar sin bloquearse (Mock / Hardcode / Aislamiento)
Para no depender de si el compañero ya terminó o subió US-016:

1. **Persistencia atómica propia:**
   Dentro del Server Action de registro de consulta (`registrarConsultaMedicaAction`), se ejecuta una transacción Prisma `$transaction` que:
   - Crea la fila `Consulta`.
   - Actualiza el `Turno` estableciendo `resultado: "ATENDIDO"` y `atendidoEn: new Date()`.
   Esto cubre el requerimiento de US-017 y a la vez cumple con la especificación de US-016 sin esperar su código.

2. **Capa de abstracción modular (`src/lib/turnos/resultado-atencion.ts`):**
   Se crea un helper aislado para consultar y verificar el resultado de atención:
   ```ts
   // [INTEGRACION-US016] Helper de compatibilidad mientras se incorpora US-SIG-016.
   export function validarCitaAptaParaConsulta(turno: {
     estado: string;
     resultado: string;
     inicio: Date | string;
     jornadaSuspendida?: boolean;
   }): { puede: boolean; motivo: string };
   ```
   Si la cita tiene `resultado === "AUSENTE"`, se rechaza con el mensaje exacto correspondiente.

3. **Mocks y datos para pruebas:**
   - Para verificar en local el comportamiento cuando una cita está `AUSENTE`, se incluye en el seed y en helpers de prueba turnos con `resultado: "AUSENTE"`.
   - Cuando el compañero suba la US-SIG-016 con la UI para marcar ausencias, ambos módulos encajarán sinérgicamente porque comparten la misma columna `turno.resultado` y el mismo enum.

---

## 3. Decisiones de diseño y arquitectura

| Tema | Decisión |
| --- | --- |
| **Ubicación de la funcionalidad** | En la ficha existente `/medico/turnos/[id]` (Server Component) y formulario interactivo `consulta-medica-form.tsx` (Client Component). |
| **Flujo de atención** | Si el turno está listo para atención (`evaluarInicioAtencion` = true y `resultado === "SIN_REGISTRAR"`), la ficha despliega el formulario de registro. Una vez guardado, se recarga y muestra la consulta en modo lectura. |
| **Inmutabilidad clínica (CA4)** | `Consulta` no tiene endpoint de actualización ni eliminación (`UPDATE` o `DELETE`). El formulario desaparece tras guardar y se renderiza el bloque estático de la consulta. |
| **Validación de diagnóstico** | Validación doble: en cliente (HTML5 `required` + feedback visual) y en servidor (Zod / `trim().length > 0`). Coincide con el constraint `CHECK (length(trim(diagnostico)) > 0)` de la base de datos (D-16). |
| **Idempotencia (CA3)** | Clave primaria de `Consulta` es `turnoId` (`@id`). Si por reintento de red se envía dos veces la petición, la transacción detecta la existencia previa y no duplica el registro ni corrompe el estado. |
| **Seguridad y privacidad (CA5)** | Validación de rol `MEDICO` con `requireRole("MEDICO")`. El turno consultado debe pertenecer al profesional (`disponibilidad.profesionalId === sesion.usuarioId`). Si no coincide, retorna `notFound()` para no filtrar existencia de turnos ajenos. Los Administradores que intenten acceder reciben redirección a `/sin-permiso`. |
| **Auditoría** | Se audita en la tabla `auditoria` bajo la acción `"Registro de consulta médica"`, con `actor_id` = médico, `entidad` = `"consulta"`, `registro_id` = `turno_id`. No se graban detalles clínicos sensibles en la auditoría para preservar el secreto profesional. |

---

## 4. Mensajes exactos (español)

| Caso | Mensaje literal |
| --- | --- |
| **Diagnóstico vacío** | El diagnóstico es obligatorio para registrar la consulta médica. |
| **Éxito al guardar** | Consulta médica registrada con éxito. |
| **Cita no encontrada o no propia** | La cita médica no existe o no tenés autorización para acceder a ella. |
| **Cita no confirmada** | Solo se pueden atender citas en estado confirmada. |
| **Jornada suspendida** | No se puede iniciar la atención: la jornada se encuentra suspendida. |
| **Horario no alcanzado** | Todavía no llegó el horario de inicio de la cita. |
| **Cita ya atendida (duplicado)** | Esta cita ya cuenta con una consulta médica registrada. |
| **Cita con ausencia registrada (US-016)** | No se puede registrar la consulta: la cita fue marcada como ausente. |
| **Sin permiso (rol)** | Tu rol no tiene permiso para documentar consultas médicas. |
| **Guardando formulario** | Guardando consulta… |
| **Botón de acción** | Registrar consulta |
| **Título del formulario** | Registrar consulta médica |
| **Título de notas guardadas** | Consulta clínica registrada |

---

## 5. Rutas y navegación

| URL | Acceso | Propósito |
| --- | --- | --- |
| `/medico` | Solo `MEDICO` | Agenda médica con lista de turnos del día/mes. Permite hacer clic en "Ver ficha" de cada turno. |
| `/medico/turnos/[id]` | Solo `MEDICO` autor | Ficha de la cita: si está pendiente y en hora, muestra el formulario de US-017; si ya fue atendida, muestra la consulta clínica guardada. |
| `/sin-permiso` | Otros roles (`ADMIN`, `PACIENTE`, `ENFERMERIA`) | Redirección 403 al intentar acceder a la ficha o endpoints de atención médica. |

---

## 6. Árbol de archivos a crear o modificar

```
src/
  lib/
    auth/
      constants.ts                         # MOD: agregar AUDITORIA.REGISTRO_CONSULTA_MEDICA y mensajes MSG
    agenda/
      reglas.ts                            # MOD: complementar evaluarInicioAtencion con chequeo de resultado SIN_REGISTRAR
      servicio-agenda.ts                   # MOD: conectar obtenerTurnoMedico con Prisma/Turno real y Consulta
    turnos/
      resultado-atencion.ts                # NUEVO: helper desacoplado para validar resultado de atención (transición US-016)
      consulta-clinica.ts                  # NUEVO: funciones de dominio, tipados y lectura de consultas clínicas
  app/
    actions/
      consultas.ts                         # NUEVO: Server Action registrarConsultaMedicaAction()
    (app)/
      medico/
        turnos/
          [id]/
            page.tsx                       # MOD: reemplazar mock de notas clínicas por formulario/vista real
            consulta-medica-form.tsx       # NUEVO: Client Component con validación y estados de envío
            consulta-detalle-view.tsx      # NUEVO: Componente para visualización inmutable de consulta guardada
docs/
  PLAN-US-017.md                           # Este documento de especificación
  DECISIONES.md                            # Registro de decisión D-21
prisma/
  seed.ts                                  # MOD: agregar turnos pasados/presentes listos para probar atención
```

---

## 7. Contratos de código

### 7.1 Esquema de validación y tipos (`src/lib/turnos/consulta-clinica.ts`)

```ts
export interface RegistrarConsultaInput {
  turnoId: string;
  diagnostico: string;
  sintomas?: string;
  indicaciones?: string;
  medicacion?: string;
  estudios?: string;
  observaciones?: string;
  certificado?: string;
}

export type ResultadoRegistroConsulta =
  | { exito: true; consultaId: string }
  | { exito: false; error: string };

export interface ConsultaClinicaViewData {
  turnoId: string;
  autorId: string;
  autorNombre: string;
  diagnostico: string;
  sintomas: string | null;
  indicaciones: string | null;
  medicacion: string | null;
  estudios: string | null;
  observaciones: string | null;
  certificado: string | null;
  creadaEn: string; // ISO format
}
```

### 7.2 Server Action (`src/app/actions/consultas.ts`)

```ts
"use server";

export async function registrarConsultaMedicaAction(
  formData: FormData
): Promise<ResultadoRegistroConsulta> {
  // 1. requireRole("MEDICO")
  // 2. Extraer campos y sanitizar con trim()
  // 3. Validar que diagnostico no esté vacío
  // 4. Buscar el turno en Prisma con disponibilidad, jornada y paciente
  // 5. Validar pertenencia: disponibilidad.profesionalId === sesion.usuarioId
  // 6. Validar estado: CONFIRMADO, no suspendido, inicio <= now(), resultado === SIN_REGISTRAR
  // 7. Prisma.$transaction:
  //    a) Crear Consulta
  //    b) Actualizar Turno: resultado = "ATENDIDO", atendidoEn = new Date()
  //    c) Crear Auditoria: accion = AUDITORIA.REGISTRO_CONSULTA_MEDICA
  // 8. revalidatePath(`/medico/turnos/${turnoId}`)
  // 9. Retornar { exito: true }
}
```

---

## 8. Cómo testear el flujo

### 8.1 Verificación automatizada previa

Ejecutar las compuertas de calidad del proyecto:
```bash
npm run format
npm run lint
npm run format:check
npm run build
```
Todas deben terminar con código de salida `0` sin advertencias críticas.

---

### 8.2 Checklist de pruebas manuales paso a paso (E2E)

Para ejecutar estas pruebas, iniciar el servidor de desarrollo (`npm run dev`) y utilizar las credenciales del entorno de pruebas:
- **Médico demo:** `medico@sigsam.local` / `Medico@1234`
- **Administrador:** `admin@sigsam.local` / `Admin@1234`
- **Paciente:** `paciente@sigsam.local` / `Paciente@1234`

#### Escenario 1: Flujo feliz — Registro exitoso de consulta médica (CA1, CA2, CA3)
1. Iniciar sesión como `medico@sigsam.local` (`Medico@1234`).
2. Dirigirse a la agenda médica en `/medico` (vista Mes, octubre 2026).
3. Seleccionar una cita confirmada en horario transcurrido (por ejemplo, **Cita ID `2`** del 2026-10-08 a las 06:48 hs, paciente **Juan Pérez**):
   - URL directa: `http://localhost:3000/medico/turnos/2`
4. En la ficha de la cita:
   - Se muestra la sección **"Resultado de atención"** (US-16) con estado `Sin registrar`.
   - Se muestra el formulario **"Registrar consulta médica"** (US-17).
   - Completar el campo obligatorio:
     - **Diagnóstico:** `"Gastroenteritis aguda leve con deshidratación grado I"`
   - Completar campos opcionales:
     - **Síntomas:** `"Náuseas, vómitos de 24 hs de evolución, dolor abdominal difuso"`
     - **Indicaciones:** `"Reposo 48 hs, hidratación oral con sales de rehidratación"`
     - **Medicación:** `"Reliverán 1 comprimido cada 8 hs si hay náuseas"`
     - **Estudios:** `"Coprocultivo si persisten síntomas"`
   - Hacer clic en el botón **"Registrar consulta"**.
5. **Resultado esperado:**
   - Se muestra mensaje de éxito: `"Consulta médica registrada con éxito."`
   - La pantalla se actualiza y la sección pasa a mostrar **"Consulta clínica registrada"** en modo de solo lectura.
   - En **"Resultado de atención"**, el resultado cambió automáticamente a **`Atendido`**.
   - En la base de datos:
     - Se creó la fila en la tabla `consulta` con el `turno_id` correspondiente.
     - En la tabla `turno`, el campo `resultado` cambió a `ATENDIDO` y `atendido_en` tiene la fecha/hora actual.
     - En la tabla `auditoria` se registró la acción `"Registro de consulta médica"`.

#### Escenario 2: Validación de campo obligatorio diagnóstico (CA2)
1. Abrir otra cita confirmada en horario transcurrido (por ejemplo, **Cita ID `13`** en `http://localhost:3000/medico/turnos/13`).
2. Dejar el campo **Diagnóstico** en blanco (o solo espacios en blanco) y rellenar otros campos (ej. Síntomas).
3. Intentar presionar **"Registrar consulta"**.
4. **Resultado esperado:**
   - La validación del navegador y del servidor detiene el envío.
   - Se muestra el mensaje de error: `"El diagnóstico es obligatorio para registrar la consulta médica."`
   - No se crea ninguna consulta en la base de datos ni cambia el estado del turno.

#### Escenario 3: Inmutabilidad — Sin edición ni borrado (CA4)
1. Con la cita del Escenario 1 ya atendida (**Cita ID `2`**), recargar la página `http://localhost:3000/medico/turnos/2`.
2. **Resultado esperado:**
   - No aparece el botón "Iniciar atención" ni ningún formulario editable.
   - Se exhiben el diagnóstico y las indicaciones grabadas originalmente.
   - No existen botones de "Editar", "Eliminar" ni "Modificar".

#### Escenario 4: Bloqueo de citas antes de hora (CA1)
1. Abrir la **Cita ID `5`** (`http://localhost:3000/medico/turnos/5`), que corresponde a una fecha/hora futura.
2. **Resultado esperado:**
   - El botón de iniciar atención está deshabilitado.
   - Se muestra el mensaje informativo: `"Todavía no llegó el horario de inicio de la cita."`

#### Escenario 5: Bloqueo de citas en jornada suspendida o canceladas (CA1)
1. Visualizar una cita confirmada perteneciente a una jornada marcada como `SUSPENDIDA` o una cita cancelada (por ejemplo **Cita ID `1`** o **Cita ID `4`**).
2. Abrir la ficha de la cita.
3. **Resultado esperado:**
   - Se indica claramente el motivo bloqueante (jornada suspendida o cita cancelada).
   - El formulario de consulta médica no está disponible.

#### Escenario 6: Confidencialidad y control de acceso (CA5)
1. Como `medico@sigsam.local`, intentar acceder por URL a `/medico/turnos/99999` o a una cita que pertenece a otro médico.
2. **Resultado esperado:** Se recibe página 404 (`notFound()`), sin revelar detalles de la cita.
3. Iniciar sesión como `admin@sigsam.local` e intentar navegar a `http://localhost:3000/medico/turnos/2`.
4. **Resultado esperado:** El administrador es redirigido a `/sin-permiso`. El rol administrador no tiene acceso a notas clínicas.

#### Escenario 7: Integración con US-SIG-016 (Cita con ausencia registrada)
1. Abrir la **Cita ID `12`** (`http://localhost:3000/medico/turnos/12`), que fue registrada como `Ausente`.
2. **Resultado esperado:**
   - En **Atención clínica**, el botón de atención está deshabilitado y se muestra:
     `"No se puede registrar la consulta: la cita fue marcada como ausente."`
   - El sistema no permite documentar una atención sobre un turno ausente (CA4 de US-016 y CA1 de US-017).

---

## 9. Registro de decisiones arquitectónicas

Se incorporó en `docs/DECISIONES.md`:

### D-21 — Registro inmutable de consulta médica y transición con resultado de atención
- **Estado:** Aceptada (2026-10-15)
- **Decisión:** La documentación clínica de una consulta médica (US-SIG-017) se implementa de forma estrictamente inmutable sobre la tabla `consulta`, exigiendo diagnóstico no vacío y permitiendo campos complementarios opcionales (síntomas, indicaciones, medicación, estudios, observaciones, certificado). La acción se restringe al médico titular de la cita confirmada y en horario transcurrido. Al confirmarse el guardado, se actualiza atómicamente el turno a `resultado = ATENDIDO` y se sella `atendido_en = now()`, auditando la operación sin persistir datos sensibles en la bitácora. La ausencia de US-SIG-016 en este estadio se resuelve desacoplando la validación de estados (`SIN_REGISTRAR`, `ATENDIDO`, `AUSENTE`) mediante helpers de transición, garantizando compatibilidad directa cuando se integre el módulo de ausencias.
- **Motivo:** Cumplimiento de CA1 a CA5 de US-SIG-017, preservación del secreto médico y consistencia relacional.

