# Plan de implementación — US-SIG-007 Configurar la duración y el arancel de las prestaciones

Este archivo es la especificación detallada para implementar la historia **US-SIG-007** en SIGSAM. Sigue estrictamente el estándar de `docs/PLAN-US-001.md` y `docs/PLAN-US-006.md`. No agrega alcance innecesario. Si algo no está escrito acá, no lo inventes.

---

## 0. Qué hacer y qué no hacer

Implementar únicamente **US-SIG-007** (RF-09). Al terminar la implementación:

1. **El Administrador** accede a `/admin/parametros` (enlace ya presente en la navegación principal del `AppShell`).
2. En la pantalla `/admin/parametros`:
   - Visualiza la configuración de **cada médico** activo: profesional, especialidad, duración actual del turno (en minutos) y arancel actual (en pesos ARS).
   - Puede modificar la **duración del turno** (minutos enteros positivos) y el **arancel particular** (importe en pesos, admite 0 y hasta dos decimales; no admite negativos) para cada médico individualmente.
   - Visualiza la lista de **tipos de vacunas** con su arancel particular actual y la indicación explícita de su **duración fija de 15 minutos**.
   - Puede modificar el **arancel** de cada tipo de vacuna (admite 0 y hasta dos decimales; no admite negativos).
   - Se muestra un bloque explicativo con las reglas de negocio sobre vigencia y turnos confirmados (CA3 y CA4).
3. Al guardar una actualización:
   - Se valida en cliente y servidor el formato numérico (duración > 0 entera; arancel ≥ 0 con hasta dos decimales).
   - Se persiste en la base de datos (`medico.duracion_turno_min`, `medico.arancel_actual` o `vacuna.arancel_actual`).
   - Se registra una entrada de auditoría con la acción (`"Configuración de duración y arancel médico"` o `"Configuración de arancel de vacuna"`), el Administrador responsable como `actor_id` y el detalle de los valores previos y nuevos.
   - Las citas ya confirmadas **conservan** su duración y arancel de referencia históricos grabados en la fila de `turno` (CA3).
   - No se alteran ni regeneran automáticamente disponibilidades ni turnos con citas confirmadas o retenciones vigentes (CA4).
4. La interfaz funciona en navegador de escritorio y en pantallas móviles (ancho mínimo 390px).

### No hacer:
- **No** permitir valores de duración menores o iguales a 0 ni con decimales (la duración debe ser un entero positivo).
- **No** permitir aranceles negativos.
- **No** permitir que el Administrador edite los umbrales de alerta de stock ni registre movimientos de inventario o aplicaciones de vacunas desde esta pantalla (CA5: los umbrales e inventario corresponden a Enfermería).
- **No** permitir modificar la duración del turno de vacunación (es fija en 15 minutos por regla del negocio CA2).
- **No** modificar turnos ya confirmados ni retenciones activas existentes (CA3 y CA4).
- **No** permitir acceso a roles distintos de `ADMIN` (los médicos, enfermeros y pacientes son redirigidos según corresponda).
- **No** instalar dependencias adicionales.

---

## 1. Criterios de Aceptación (US-SIG-007)

Texto de la historia: *Como administrador, quiero establecer duraciones y aranceles, para ofrecer horarios definidos y registrar el importe correspondiente a cada atención.*

- **CA1.** Se establece una duración en minutos enteros positivos y un arancel particular en pesos para cada médico. El importe admite cero y hasta dos decimales; no admite valores negativos.
- **CA2.** Cada tipo de vacuna tiene un arancel, que puede ser cero. Su agenda utiliza intervalos fijos de 15 minutos.
- **CA3.** Cada reserva confirmada conserva su duración y arancel de referencia. Modificar la configuración no cambia citas ya confirmadas.
- **CA4.** Una nueva duración se aplica al generar o volver a publicar días editables. Nunca regenera automáticamente días con citas o retenciones vigentes.
- **CA5.** Administrar aranceles no concede funciones de aplicación ni de movimientos de stock. Los umbrales de inventario corresponden a Enfermería.

---

## 2. Decisiones de diseño y arquitectura

| Tema | Decisión |
| --- | --- |
| **Ubicación de la funcionalidad** | Ruta protegida `/admin/parametros` (dentro del grupo de rutas `(app)/admin`). Accesible desde la barra lateral/navegación con el enlace "Parámetros". |
| **Pestañas / Secciones de la vista** | Dos secciones claramente delimitadas: 1) **Consultas médicas** (por profesional médico) y 2) **Vacunatorio** (por tipo de vacuna). |
| **Inmutabilidad de turnos pasados/confirmados (CA3)** | El modelo `Turno` en la base ya almacena snapshots de `duracionMin` y `arancel`. Al actualizar `Medico` o `Vacuna`, no se tocan los turnos ya creados. |
| **Duración fija de vacunatorio (CA2)** | El campo de duración para vacunas se muestra como solo lectura fijo: `15 minutos (fijo por protocolo)`. No es editable en BD ni en UI. |
| **Umbrales de stock no editables (CA5)** | En `/admin/parametros` solo se actualiza `Vacuna.arancelActual`. Los campos `umbralMinimo`, lotes y movimientos de stock quedan totalmente fuera del formulario del Administrador. |
| **Auditoría (acciones exactas)** | `"Configuración de duración y arancel médico"` (actor: Admin, ref: Usuario médico, entidad: "medico")<br>`"Configuración de arancel de vacuna"` (actor: Admin, ref: Vacuna, entidad: "vacuna"). |
| **Detalle de auditoría** | JSON legible con valores anteriores y nuevos (ej. `{"duracionAnterior": 20, "duracionNueva": 30, "arancelAnterior": 5000, "arancelNuevo": 7500}`). |
| **Manejo de tipos BigInt y Decimal** | Los datos leídos de Prisma se serializan como objetos simples (`string` o `number`) para los componentes interactivos cliente. |

---

## 3. Mensajes exactos (español)

Usar estos textos literales sin parafrasear:

| Caso | Texto |
| --- | --- |
| **Duración vacía o menor/igual a 0** | La duración debe ser un número entero mayor a 0 minutos. |
| **Duración con decimales** | La duración debe ser un número entero en minutos. |
| **Arancel médico vacío o negativo** | El arancel debe ser un importe mayor o igual a 0. |
| **Arancel con más de 2 decimales** | El arancel admite como máximo dos decimales. |
| **Arancel vacuna negativo** | El arancel de la vacuna debe ser un importe mayor o igual a 0. |
| **Éxito al guardar médico** | Configuración del médico actualizada con éxito. |
| **Éxito al guardar vacuna** | Arancel de la vacuna actualizado con éxito. |
| **Médico no encontrado o inactivo** | El profesional médico no fue encontrado o no está activo. |
| **Vacuna no encontrada** | El tipo de vacuna solicitado no fue encontrado. |
| **Sin permiso** | Tu rol no tiene permiso para modificar parámetros del sistema. |
| **Aviso regla CA3 y CA4** | Las citas confirmadas previamente conservan su duración y arancel históricos. Los cambios se aplicarán en futuras publicaciones de agenda y nuevas reservas. |
| **Aviso regla CA2 y CA5** | La duración de las aplicaciones de vacunación está fijada por protocolo en 15 minutos. El inventario y umbrales de stock son gestionados exclusivamente por Enfermería. |

---

## 4. Rutas y navegación

| URL | Acceso | Propósito |
| --- | --- | --- |
| `/admin/parametros` | Solo `ADMIN` | Pantalla principal de configuración de duraciones y aranceles de consultas médicas y vacunatorio. |
| `/sin-permiso` | Otros roles autenticados | Pantalla estándar 403 en caso de intentar acceder sin rol `ADMIN`. |

---

## 5. Árbol de archivos a crear o modificar

```
prisma/
  seed.ts                                     # Sembrar especialidades, perfil Medico demo y tipos de vacuna
src/
  lib/
    auth/
      constants.ts                            # Agregar constantes de auditoría y mensajes para parámetros
      audit.ts                                # Generalizar soporte de entidad y detalle en auditoría
  app/
    actions/
      parametros.ts                           # Server Actions: actualizarConfiguracionMedico, actualizarArancelVacuna
    (app)/
      admin/
        parametros/
          page.tsx                            # Server Component que carga médicos y vacunas
          admin-parametros-view.tsx           # Client Component con lista de médicos, edición modal/in-place y vacunas
docs/
  PLAN-US-007.md                              # Este documento de especificación
  DECISIONES.md                               # Registro de decisión D-19
```

---

## 6. Contratos de código

### 6.1 `src/lib/auth/constants.ts`
Extender `AUDITORIA` y `MSG`:
```ts
export const AUDITORIA = {
  // ... existentes ...
  CONFIGURACION_MEDICO: "Configuración de duración y arancel médico",
  CONFIGURACION_VACUNA: "Configuración de arancel de vacuna",
} as const;

export const MSG = {
  // ... existentes ...
  DURACION_INVALIDA: "La duración debe ser un número entero mayor a 0 minutos.",
  DURACION_DECIMAL: "La duración debe ser un número entero en minutos.",
  ARANCEL_INVALIDO: "El arancel debe ser un importe mayor o igual a 0.",
  ARANCEL_DECIMALES: "El arancel admite como máximo dos decimales.",
  ARANCEL_VACUNA_INVALIDO: "El arancel de la vacuna debe ser un importe mayor o igual a 0.",
  CONFIGURACION_MEDICO_EXITO: "Configuración del médico actualizada con éxito.",
  CONFIGURACION_VACUNA_EXITO: "Arancel de la vacuna actualizado con éxito.",
  MEDICO_NO_ENCONTRADO: "El profesional médico no fue encontrado o no está activo.",
  VACUNA_NO_ENCONTRADA: "El tipo de vacuna solicitado no fue encontrado.",
} as const;
```

### 6.2 `src/lib/auth/audit.ts`
Permitir entidad y detalle opcionales:
```ts
export async function registrarAuditoria(input: {
  actorId: bigint;
  accion: AccionAuditable;
  referenciaId: bigint;
  entidad?: string;
  detalle?: string | null;
}): Promise<void>
```

### 6.3 Server Actions (`src/app/actions/parametros.ts`)

```ts
export type ResultadoParametros = {
  error?: string;
  exito?: boolean;
  mensaje?: string;
};

export async function actualizarConfiguracionMedico(input: {
  medicoUsuarioId: string;
  duracionMin: number;
  arancel: number;
}): Promise<ResultadoParametros>
```
1. Validar sesión con `requireRole("ADMIN")`.
2. Validar `duracionMin`: número entero positivo (`Number.isInteger(duracionMin) && duracionMin > 0`). Si no, retornar `MSG.DURACION_INVALIDA` o `MSG.DURACION_DECIMAL`.
3. Validar `arancel`: número finito ≥ 0, con máximo 2 decimales (`/^\d+(\.\d{1,2})?$/.test(arancel.toFixed(2))`). Si no, `MSG.ARANCEL_INVALIDO`.
4. Buscar médico por `usuarioId = BigInt(input.medicoUsuarioId)` incluyendo `usuario` y `especialidad`.
5. Si no existe o `usuario.activo === false`, retornar `MSG.MEDICO_NO_ENCONTRADO`.
6. En una transacción:
   - Actualizar `medico`: `duracionTurnoMin: duracionMin`, `arancelActual: new Decimal(arancel)`.
   - Registrar auditoría con `accion: AUDITORIA.CONFIGURACION_MEDICO`, `entidad: "medico"`, `referenciaId: medico.usuarioId`, `detalle: JSON.stringify({ duracionAnterior, duracionNueva: duracionMin, arancelAnterior, arancelNuevo: arancel })`.
7. Retornar `{ exito: true, mensaje: MSG.CONFIGURACION_MEDICO_EXITO }`.

```ts
export async function actualizarArancelVacuna(input: {
  vacunaId: string;
  arancel: number;
}): Promise<ResultadoParametros>
```
1. Validar sesión con `requireRole("ADMIN")`.
2. Validar `arancel`: número finito ≥ 0, con máximo 2 decimales. Si no, retornar `MSG.ARANCEL_VACUNA_INVALIDO`.
3. Buscar vacuna por `id = BigInt(input.vacunaId)`.
4. Si no existe, retornar `MSG.VACUNA_NO_ENCONTRADA`.
5. En una transacción:
   - Actualizar `vacuna`: `arancelActual: new Decimal(arancel)`.
   - Registrar auditoría con `accion: AUDITORIA.CONFIGURACION_VACUNA`, `entidad: "vacuna"`, `referenciaId: vacuna.id`, `detalle: JSON.stringify({ arancelAnterior, arancelNuevo: arancel })`.
6. Retornar `{ exito: true, mensaje: MSG.CONFIGURACION_VACUNA_EXITO }`.

---

## 7. UI y Componentes

### 7.1 `/admin/parametros/page.tsx`
- Requiere rol `ADMIN`.
- Carga médicos con sus especialidades y datos de usuario.
- Carga tipos de vacunas.
- Renderiza el componente de cliente `AdminParametrosView`.

### 7.2 `AdminParametrosView`
- **Cabecera**:
  - Título: "Duración y aranceles".
  - Descripción: "Configuración de duración de turnos y aranceles particulares para consultas médicas y vacunatorio."
- **Notas informativas de reglas del negocio**:
  - Banner explicativo con las reglas CA2, CA3, CA4 y CA5 (citas confirmadas inalterables, duración de vacunatorio de 15 min fija, inventario a cargo de Enfermería).
- **Selector de sección / Pestañas**:
  - Pestaña 1: "Consultas médicas" (médicos y especialistas).
  - Pestaña 2: "Vacunatorio" (tipos de vacuna).
- **Sección Médicos**:
  - Tabla / tarjeta de cada profesional médico:
    - Nombre del médico y especialidad.
    - Duración actual (ej: "20 min") y Arancel actual (ej: "$8.000,00").
    - Botón "Editar configuración" que abre un modal o formulario accesible para modificar:
      - Input numérico "Duración del turno (minutos)" (min 1, paso 1, sin decimales).
      - Input numérico "Arancel particular (ARS)" (min 0, paso 0.01, admite 0).
      - Botones "Guardar cambios" y "Cancelar".
      - Feedback de validación y estado de guardado.
- **Sección Vacunas**:
  - Tabla / tarjeta de cada vacuna:
    - Nombre de la vacuna y descripción.
    - Duración: etiqueta fija "15 min (fijo por protocolo)".
    - Arancel actual (ej: "$0,00" o "$4.500,00").
    - Botón "Editar arancel" que abre modal/formulario accesible:
      - Input numérico "Arancel particular (ARS)" (min 0, paso 0.01, admite 0).
      - Texto explícito: "La duración es fija (15 minutos). El umbral de stock y movimientos corresponden a Enfermería."
      - Botones "Guardar arancel" y "Cancelar".
      - Feedback de validación y estado de guardado.

---

## 8. Estilos y accesibilidad

- Colores y tokens de Tailwind v4 definidos en `globals.css`:
  - Canvas: `#f7f9fa`, Surface: `#ffffff`, Line: `#d7e2e4`, Ink: `#18323a`, Brand: `#145f65`.
- Todos los inputs interactivos deben tener un alto mínimo de 44px (`min-h-[44px]`).
- Los mensajes de error utilizan `role="alert"` y `aria-invalid="true"`.
- Los mensajes de éxito utilizan `role="status"`.
- En dispositivos móviles (<768px), las tablas se adaptan con tarjetas de bloque legible con botones de tamaño táctil.

---

## 9. Datos de prueba / seed

Extender `prisma/seed.ts` de forma idempotente para incluir:
1. Especialidades:
   - "Clínica Médica"
   - "Pediatría"
   - "Traumatología"
2. Registro de `Medico` para `medico@sigsam.local`:
   - Especialidad: "Clínica Médica"
   - `duracionTurnoMin`: 20
   - `arancelActual`: 5000.00
3. Tipos de vacuna iniciales:
   - "Antigripal" (umbral: 10, arancel: 0.00, descripcion: "Vacuna antigripal anual para grupos de riesgo y adultos.")
   - "Hepatitis B" (umbral: 10, arancel: 0.00, descripcion: "Vacuna contra hepatitis B para adultos y personal de salud.")
   - "Fiebre Amarilla" (umbral: 5, arancel: 4500.00, descripcion: "Dosis única para viajeros a zonas endémicas.")
   - "Neumococo 23" (umbral: 8, arancel: 2500.00, descripcion: "Vacuna antineumocócica polisacárida.")

---

## 10. Documentar la decisión

Agregar a `docs/DECISIONES.md`:
### D-19 — Configuración de duración y arancel por prestación
- **Estado:** Aceptada (2026-10-05)
- **Decisión:** La duración de turno y arancel particular de consultas se definen por médico en la tabla `medico`, validando minutos enteros estrictamente positivos y arancel no negativo con hasta 2 decimales. Para el vacunatorio, el arancel se configura por tipo de vacuna en la tabla `vacuna` (admitiendo cero), mientras que su duración es invariable y fija en 15 minutos. Las modificaciones no alteran citas ya confirmadas ni retenciones activas existentes (preservadas en snapshots de `turno`).
- **Motivo:** Cumplimiento de CA1, CA2, CA3, CA4 y CA5 de US-SIG-007 y RF-09.

---

## 11. Orden de implementación

1. Extender constantes y mensajes en `src/lib/auth/constants.ts`.
2. Actualizar función `registrarAuditoria` en `src/lib/auth/audit.ts`.
3. Actualizar `prisma/seed.ts` para crear especialidades, médico demo y vacunas iniciales de forma idempotente.
4. Crear Server Actions en `src/app/actions/parametros.ts` (`actualizarConfiguracionMedico`, `actualizarArancelVacuna`).
5. Crear componente cliente `src/app/(app)/admin/parametros/admin-parametros-view.tsx`.
6. Actualizar `src/app/(app)/admin/parametros/page.tsx` para cargar datos y renderizar la vista.
7. Documentar decisión D-19 en `docs/DECISIONES.md`.
8. Ejecutar compuertas automáticas (`format`, `lint`, `format:check`, `build`).
9. Realizar commit y merge a `stage`.

---

## 12. Verificación

### 12.1 Compuertas automatizadas
Deben salir con código 0 en este orden:
```bash
npm run format
npm run lint
npm run format:check
npm run build
```

### 12.2 Checklist manual paso a paso

- **CA1.** Entrar como Administrador (`admin@sigsam.local`). Navegar a `/admin/parametros`:
  - En la sección "Consultas médicas", verificar que se visualiza a la Dra. Valeria Ruiz con su duración actual (ej. 20 min) y arancel actual (ej. $5000.00).
  - Hacer clic en "Editar configuración".
  - Probar ingresar duración 0 o negativa o decimal (ej. -5 o 20.5) → se rechaza con error: "La duración debe ser un número entero mayor a 0 minutos."
  - Probar ingresar arancel negativo (ej. -100) → se rechaza con error: "El arancel debe ser un importe mayor o igual a 0."
  - Ingresar duración 30 y arancel 7500.50 y guardar → se actualiza exitosamente con mensaje "Configuración del médico actualizada con éxito."
  - En la base de datos se registra la fila en `auditoria` con acción `"Configuración de duración y arancel médico"`.
- **CA2.** En la pestaña "Vacunatorio":
  - Se visualizan las vacunas (Antigripal, Hepatitis B, Fiebre Amarilla, etc.).
  - Se visualiza el arancel actual y la duración fija de 15 minutos indicada explícitamente sin permitir editar la duración.
  - Editar arancel de Fiebre Amarilla a 0 o a 5200.00 y guardar → se actualiza exitosamente con mensaje "Arancel de la vacuna actualizado con éxito."
  - En la base de datos se registra la fila en `auditoria` con acción `"Configuración de arancel de vacuna"`.
- **CA3.** Verificar que no se modifican citas ya confirmadas:
  - Si existiesen turnos previos en la base de datos, sus columnas `duracion_min` y `arancel` permanecen idénticas a las almacenadas al momento de su reserva.
- **CA4.** Verificar que la actualización de parámetros no regenera disponibilidades ni turnos existentes.
- **CA5.** Verificar que desde la pantalla del Administrador no existe opción de modificar umbrales de stock ni registrar movimientos o aplicaciones de vacunas.
