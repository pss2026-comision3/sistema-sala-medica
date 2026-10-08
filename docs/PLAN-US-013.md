# Plan de implementación — US-SIG-013 Consultar próximos turnos y antecedentes de reservas

Este archivo es la especificación detallada para implementar la historia **US-SIG-013** en SIGSAM. Sigue estrictamente el estándar de `docs/PLAN-US-001.md`, `docs/PLAN-US-006.md` y `docs/PLAN-US-007.md`. No agrega alcance innecesario. Si algo no está escrito acá, no lo inventes.

---

## 0. Qué hacer y qué no hacer

Implementar únicamente **US-SIG-013** (RF-02). Al terminar la implementación:

1. **El Paciente o Tutor** accede a `/paciente/turnos` (enlace "Mis turnos" ya presente en la navegación del `AppShell`).
2. En `/paciente/turnos`:
   - Selecciona el **beneficiario** cuyos turnos quiere ver: su propio perfil (Titular) o los menores a cargo vinculados (CA5: nunca aparecen otros pacientes).
   - Visualiza dos secciones: **Próximos turnos** (citas futuras) y **Antecedentes** (citas pasadas y canceladas), siguiendo el wireframe SC-07 de `docs/Wireframe Sprint 1.html`.
   - Filtra por **período**, **estado** (Confirmado / Cancelado / todos) y **resultado**; el filtro por **especialidad o vacuna** se aplica según el tipo de cita (CA1).
   - Cada cita muestra: prestación (especialidad de la consulta o nombre de la vacuna), fecha, horario, estado (`Confirmado` / `Cancelado` / retención temporal) y resultado (`Sin resultado` / `Atendido` / `Ausente`) (CA2).
   - Las citas en **jornada suspendida** muestran el aviso "Requiere resolución"; una cita **reprogramada** conserva visible su antecedente de cancelación y el vínculo con su nueva cita (CA3).
   - Sobre cada cita futura elegible puede **cancelar** cuando el plazo lo permite (**24 horas o más antes del inicio**) y **descargar la factura** cuando exista un comprobante (CA4).
   - Cada cita distingue la situación de cobro: prestación particular **cobrada**, **sin cobrar** o **sin cobro al paciente** (con cobertura) (CA4).
3. Al hacer clic en una cita se abre la ficha **`/paciente/turnos/[id]`**, que **vuelve a verificar** en el servidor que la cita pertenece a un beneficiario autorizado del usuario logueado; una cita ajena responde 404 (CA5).
4. Al cancelar desde la ficha:
   - Se valida el plazo de 24 horas en cliente y servidor.
   - El turno pasa a `CANCELADO` con `cancelado_en`, `cancelado_por`, `motivo_cancelacion` y `origen_cancelacion` (CHECK `turno_cancelado_chk`).
   - Se registra auditoría con acción `"Cancelación de turno por paciente"`, el Paciente/Tutor como `actor_id` y el detalle del turno.
   - El antecedente de la cita cancelada **se conserva** en la lista (no se borra nunca).
5. La interfaz funciona en navegador de escritorio y en pantallas móviles (ancho mínimo 390px).

### No hacer:

- **No** mostrar turnos de otros pacientes ni datos agregados/estadísticas generales (CA5).
- **No** implementar generación de comprobantes ni registro de cobros: la facturación es **solo lectura** sobre las filas `comprobante_turno` y `pago_manual` existentes (si no hay fila, no hay botón de descarga).
- **No** implementar el flujo de reprogramación de turnos (pertenece a otra US); solo mostrar el vínculo cuando `reprogramado_desde_id` ya esté seteado en la base.
- **No** tocar `cancelarReserva` de `src/app/actions/reservas.ts` (sigue siendo la cancelación de retenciones temporales de 5 min) ni `liberarRetencionesExpiradas`.
- **No** modificar `src/components/agenda/*` ni el servicio de agenda del médico.
- **No** instalar dependencias adicionales.
- **No** permitir acceso a roles distintos de `PACIENTE` (otros roles son redirigidos a `/sin-permiso` o a su inicio).

---

## 1. Criterios de Aceptación (US-SIG-013)

Texto de la historia: *Como paciente o tutor, quiero consultar los turnos del beneficiario, para conocer sus próximas atenciones y el resultado de las anteriores.*

- **CA1.** Se muestran citas futuras y pasadas del registro Paciente autorizado, filtrables por período, especialidad o vacuna y estado.
- **CA2.** Cada cita identifica prestación, fecha, horario, estado Confirmado o Cancelado y resultado de atención Sin registrar, Atendido o Ausente.
- **CA3.** Las citas de jornadas suspendidas muestran que requieren resolución. Una reprogramación conserva el antecedente de cancelación y la relación con su nueva cita.
- **CA4.** Se ofrece cancelar cuando el plazo lo permite y descargar factura cuando exista. También se distingue prestación particular cobrada, sin cobrar o sin cobro al paciente.
- **CA5.** No se muestran otros pacientes ni estadísticas generales. El acceso del tutor se verifica nuevamente al abrir una cita.

Inferencias de la US (respetadas en este plan): la consulta es personal (no hay reportes globales); reserva, atención y cobro se presentan **por separado** para evitar que un pago cambie el estado médico.

---

## 2. Decisiones de diseño y arquitectura

| Tema | Decisión |
| --- | --- |
| **Ubicación** | Ruta existente `/paciente/turnos` (reemplazar el placeholder actual de `src/app/(app)/paciente/turnos/page.tsx`). Ficha individual en `/paciente/turnos/[id]` (página dedicada, patrón de `src/app/(app)/medico/turnos/[id]/page.tsx`). |
| **Guard de la lista** | `requireRole("PACIENTE")` en el Server Component de `/paciente/turnos`. |
| **Beneficiarios (CA5)** | Reutilizar `cargarBeneficiarios(usuarioId)` de `src/lib/turnos/buscar-horarios.ts:77` (titular + menores a cargo por `Paciente.tutorId`). El parámetro de URL `beneficiario` se valida contra esa lista; si no pertenece, se ignoran los filtros y se usa el primero. |
| **Filtros (CA1)** | Parámetros de `searchParams`: `beneficiario`, `periodo` (`proximos` \| `pasados` \| `todos`, default `proximos`), `estado` (`confirmado` \| `cancelado` \| `todos`, default `todos`), `resultado` (`sin_registrar` \| `atendido` \| `ausente` \| `todos`, default `todos`), `especialidad` (id, solo citas CONSULTA) y `vacuna` (id, solo citas VACUNACION). Patrón análogo a `leerFiltrosAgenda` (`src/lib/agenda/reglas.ts:67`). |
| **Fuente de datos** | Prisma real desde un Server Component (patrón de `src/app/(app)/paciente/buscar/page.tsx`). **No** se usa `src/lib/agenda/servicio-agenda.ts` (es mock). |
| **Fecha/hora de la cita** | Fecha = `Turno.disponibilidad.fecha`; hora = `Turno.hora` (`@db.Time`). El instante absoluto de inicio se calcula con `inicioTurno(fecha, hora)` (`src/lib/agenda/reglas.ts:63`, horario de la sala UTC-3). |
| **Período** | "Próximos" = inicio ≥ ahora. "Pasados" = inicio < ahora. El período se evalúa sobre el instante de inicio, no sobre la fecha sola. |
| **Jornada suspendida (CA3)** | Reutilizar la regla de `estaPendienteDeResolver` (`src/lib/agenda/reglas.ts:98`): `estado === "CONFIRMADO" && disponibilidad.estado === "SUSPENDIDA"`. |
| **Reprogramación (CA3)** | Consultar `Turno.reprogramaciones` (turnos nuevos cuyo `reprogramado_desde_id` apunta a esta cita) y `Turno.reprogramadoDesde` (antecedente). En la lista/ficha de una cita cancelada reprogramada se muestra el vínculo "Ver cita nueva"; en la cita nueva, el aviso "Reprogramada desde el turno cancelado". No se crea el flujo de reprogramación. |
| **Plazo de cancelación (CA4)** | Regla única: se puede cancelar si faltan **24 horas o más** para `inicioTurno(fecha, hora)`. Implementada en `puedeCancelarTurno()` (nueva, en `src/lib/agenda/reglas.ts`) y validada también en la Server Action. Aplica a turnos `CONFIRMADO`; las retenciones `RESERVADO` vigentes se siguen cancelando con `cancelarReserva` existente. |
| **Facturación (CA4)** | Solo lectura. Clasificación por cita: `modalidad === "CON_COBERTURA"` → **Sin cobro al paciente**; `PARTICULAR` con `pago_manual` en estado `APROBADO` → **Cobrada**; `PARTICULAR` sin pago aprobado → **Sin cobrar**. Botón "Descargar factura" solo si existe fila `comprobante_turno` **y** su `archivo_privado` no está vacío. |
| **Acceso a la descarga** | API route `GET /api/paciente/turnos/[id]/comprobante`: valida sesión `PACIENTE`, pertenencia del turno a un beneficiario autorizado y existencia del comprobante; devuelve el archivo con `Content-Disposition: attachment`. Sin generación de PDF nuevos. |
| **Verificación al abrir la cita (CA5)** | En `/paciente/turnos/[id]`: `requireRole("PACIENTE")` → cargar turno → verificar `turno.pacienteId` ∈ `cargarBeneficiarios(usuarioId)` → si no, `notFound()` (una cita ajena "no existe"). |
| **Auditoría** | Acción nueva `"Cancelación de turno por paciente"` (actor: usuario Paciente/Tutor, entidad `turno`, referencia: id del turno, detalle con `motivo` y `beneficiarioId`). |
| **Manejo de tipos BigInt y Decimal** | Los datos leídos de Prisma se serializan como `string`/`number` al pasarlos al componente cliente (patrón de PLAN-US-007 §2). |

---

## 3. Mensajes exactos (español)

Usar estos textos literales sin parafrasear:

| Caso | Texto |
| --- | --- |
| **Título de la lista** | Mis turnos |
| **Subtítulo de la lista** | Consultá el detalle de tus reservas y de las personas menores vinculadas. |
| **Sección futuros** | Próximos turnos |
| **Sección pasados** | Antecedentes |
| **Sin turnos futuros** | No hay turnos próximos. |
| **Sin antecedentes** | Todavía no hay turnos anteriores. |
| **Aviso de jornada suspendida** | Esta cita requiere resolución: la jornada está suspendida. |
| **Aviso de reprogramación (sobre la cancelada)** | Esta cita fue reprogramada. |
| **Vínculo a la cita nueva** | Ver cita nueva |
| **Vínculo al antecedente** | Ver cita original |
| **Plazo de cancelación (nota)** | Podés cancelar hasta 24 horas antes del inicio. Si falta menos tiempo, contactá a la sala. |
| **Éxito al cancelar** | Turno cancelado con éxito. |
| **Fuera de plazo** | Este turno no se puede cancelar: faltan menos de 24 horas para el inicio. |
| **Turno cancelable no encontrado** | El turno solicitado no existe o ya no está disponible para cancelar. |
| **Sin permiso sobre la cita** | No tenés acceso a esta cita. |
| **Turno no cancelable (estado)** | Solo se pueden cancelar citas confirmadas. |
| **Sin comprobante** | Esta cita no tiene factura disponible. |
| **Cobro cobrada** | Cobrada |
| **Cobro sin cobrar** | Sin cobrar |
| **Cobro sin cobro al paciente** | Sin cobro al paciente |
| **Sin comprobante archivo** | El comprobante de esta cita todavía no tiene archivo disponible. |

---

## 4. Rutas y navegación

| URL | Acceso | Propósito |
| --- | --- | --- |
| `/paciente/turnos` | Solo `PACIENTE` | Lista de próximos turnos y antecedentes del beneficiario seleccionado, con filtros. |
| `/paciente/turnos/[id]` | Solo `PACIENTE` + pertenencia verificada | Ficha de la cita con datos completos, cobro, acciones Cancelar / Descargar factura. |
| `/api/paciente/turnos/[id]/comprobante` | Solo `PACIENTE` + pertenencia verificada | Descarga del archivo del comprobante (si existe). |
| `/sin-permiso` | Otros roles autenticados | Redirección estándar sin permiso. |

---

## 5. Árbol de archivos a crear o modificar

```
src/
  lib/
    agenda/
      reglas.ts                            # MOD: agregar puedeCancelarTurno() y PLAZO_CANCELACION_MS
    auth/
      constants.ts                         # MOD: AUDITORIA.CANCELACION_TURNO_PACIENTE + mensajes MSG
    turnos/
      consulta-turnos.ts                   # NUEVO: filtros, query Prisma, serialización, clasificación de cobro
  app/
    actions/
      turnos-paciente.ts                   # NUEVO: cancelarTurnoPaciente()
    api/
      paciente/turnos/[id]/comprobante/
        route.ts                           # NUEVO: descarga del comprobante (GET)
    (app)/paciente/turnos/
      page.tsx                             # MOD: reemplazar placeholder por Server Component real
      turnos-view.tsx                      # NUEVO: Client Component con selector, filtros y secciones
      [id]/
        page.tsx                           # NUEVO: ficha de la cita (Server Component)
        cancelar-cita-button.tsx           # NUEVO: Client Component con confirmación y feedback
prisma/
  seed.ts                                  # MOD: perfil Paciente demo + turnos de prueba idempotentes
docs/
  PLAN-US-013.md                           # Este documento de especificación
  DECISIONES.md                            # Registro de decisión D-20
```

---

## 6. Contratos de código

### 6.1 `src/lib/auth/constants.ts`

```ts
export const MSG = {
  // ... existentes ...
  CANCELACION_PLAZO:
    "Este turno no se puede cancelar: faltan menos de 24 horas para el inicio.",
  CANCELACION_NO_ENCONTRADO:
    "El turno solicitado no existe o ya no está disponible para cancelar.",
  CANCELACION_ESTADO: "Solo se pueden cancelar citas confirmadas.",
  CANCELACION_EXITO: "Turno cancelado con éxito.",
  CITA_SIN_ACCESO: "No tenés acceso a esta cita.",
} as const;

export const AUDITORIA = {
  // ... existentes ...
  CANCELACION_TURNO_PACIENTE: "Cancelación de turno por paciente",
} as const;
```

### 6.2 `src/lib/agenda/reglas.ts`

```ts
/** Plazo mínimo de cancelación desde el portal (CA4 / RF-11): 24 horas. */
export const PLAZO_CANCELACION_MS = 24 * 60 * 60 * 1000;

/**
 * CA4: el paciente puede cancelar una cita confirmada cuando faltan
 * 24 horas o más para su inicio. `inicio` es el ISO de `inicioTurno()`.
 */
export function puedeCancelarTurno(
  turno: { estado: EstadoTurnoAgenda; inicio: string },
  ahora: Date = new Date(),
): { puede: boolean; motivo: string }
// - estado !== "CONFIRMADO" → { puede: false, motivo: "Solo se pueden cancelar citas confirmadas." }
// - new Date(turno.inicio).getTime() - ahora.getTime() < PLAZO_CANCELACION_MS
//     → { puede: false, motivo: MSG_CANCELACION_PLAZO }
// - si no → { puede: true, motivo: "" }
```

### 6.3 `src/lib/turnos/consulta-turnos.ts`

```ts
export type FiltrosTurnos = {
  beneficiario: string;          // id de paciente (personaId) ya validado
  periodo: "proximos" | "pasados" | "todos";
  estado: "confirmado" | "cancelado" | "todos";
  resultado: "sin_registrar" | "atendido" | "ausente" | "todos";
  especialidad?: string;         // id (solo CONSULTA)
  vacuna?: string;               // id (solo VACUNACION)
};

export function leerFiltrosTurnos(
  params: Record<string, string | string[] | undefined>,
): Omit<FiltrosTurnos, "beneficiario">;

export type SituacionCobro = "COBRADA" | "SIN_COBRAR" | "SIN_COBRO_PACIENTE";

export type TurnoLista = {
  id: string;
  fecha: string;                 // YYYY-MM-DD
  hora: string;                  // HH:MM
  inicio: string;                // ISO 8601 del inicio real (inicioTurno)
  tipo: "CONSULTA" | "VACUNACION";
  prestacion: string;            // especialidad o nombre de vacuna
  profesional: string;
  estado: "RESERVADO" | "CONFIRMADO" | "CANCELADO";
  resultado: "SIN_REGISTRAR" | "ATENDIDO" | "AUSENTE";
  pendienteDeResolver: boolean;  // CA3
  reprogramada: boolean;         // tiene turno nuevo vinculado
  reprogramadoDesdeId: string | null; // antecedente (CA3)
  situacionCobro: SituacionCobro;     // CA4
  facturaDisponible: boolean;         // CA4: existe comprobante con archivo
  cancelable: boolean;                // CA4: puedeCancelarTurno()
};

export async function obtenerTurnosPaciente(
  filtros: FiltrosTurnos,
  ahora?: Date,
): Promise<{ proximos: TurnoLista[]; antecedentes: TurnoLista[] }>;
```

Implementación (detalles obligatorios):

1. `prisma.turno.findMany` con `where: { pacienteId: BigInt(filtros.beneficiario) }` e `include`: `disponibilidad` (fecha, estado, motivoSuspension), `disponibilidad.profesional` → `persona` + `medico.especialidad`, `vacuna`, `pagos`, `comprobantes`, `reprogramaciones` (select `id`), `reprogramadoDesde` (select `id`).
2. Filtros en memoria sobre el resultado serializado: período por `inicio` vs `ahora`; `estado` (mapear `confirmado`→CONFIRMADO, `cancelado`→CANCELADO, `todos`→ambos); `resultado`; `especialidad`/`vacuna` por id (las condiciones de especialidad solo aplican a `tipo === "CONSULTA"` y las de vacuna a `VACUNACION`; si no coincide el tipo, el turno queda excluido cuando el filtro está activo).
3. `situacionCobro`: `CON_COBERTURA` → `SIN_COBRO_PACIENTE`; `PARTICULAR` con algún `pagos.find(p => p.estado === "APROBADO")` → `COBRADA`; resto → `SIN_COBRAR`.
4. `facturaDisponible`: existe `comprobantes[0]` con `archivoPrivado` no vacío.
5. `cancelable`: `puedeCancelarTurno({ estado, inicio }, ahora).puede`.
6. `proximos` = `inicio >= ahora` ordenado asc; `antecedentes` = el resto ordenado desc.
7. Todos los `BigInt` → `string` y `Decimal` → `string` en la serialización.

### 6.4 `src/app/actions/turnos-paciente.ts`

```ts
export async function cancelarTurnoPaciente(input: {
  turnoId: string;
  motivo?: string;
}): Promise<{ exito: true; mensaje: string } | { error: string }>
```

1. `requireRole("PACIENTE")` → `usuarioId`.
2. Cargar turno con `disponibilidad { fecha }`; si no existe → `MSG.CANCELACION_NO_ENCONTRADO`.
3. Verificar pertenencia: `turno.pacienteId` debe estar en `cargarBeneficiarios(usuarioId)`; si no → `MSG.CITA_SIN_ACCESO`.
4. `turno.estado !== "CONFIRMADO"` → `MSG.CANCELACION_ESTADO`.
5. `!puedeCancelarTurno({ estado, inicio: inicioTurno(fecha, hora) })` → `MSG.CANCELACION_PLAZO`.
6. En `prisma.$transaction`:
   - `turno.update`: `estado: "CANCELADO"`, `canceladoEn: ahora`, `canceladoPor: usuarioId`, `motivoCancelacion: motivo || "Cancelación por el paciente"`, `origenCancelacion: "paciente"`, `retenidoHasta: null`.
   - `auditoria.create`: `actorId: usuarioId`, `accion: AUDITORIA.CANCELACION_TURNO_PACIENTE`, `entidad: "turno"`, `referenciaId: turnoId`, `detalle: JSON.stringify({ beneficiarioId, motivo })`.
7. Retornar `{ exito: true, mensaje: MSG.CANCELACION_EXITO }`.

### 6.5 `GET /api/paciente/turnos/[id]/comprobante`

1. `requireSession()` + `rol === "PACIENTE"` (misma lógica de guards; responde 401/403 según el patrón de `src/app/api/paciente/buscar/resultados/route.ts`).
2. Turno existe y `pacienteId ∈ cargarBeneficiarios(usuarioId)`; si no → 404.
3. `comprobante = turno.comprobantes[0]`; sin comprobante → 404 (`MSG` "Esta cita no tiene factura disponible.").
4. `archivoPrivado` vacío → 409 con `MSG.SIN_COMPROBANTE_ARCHIVO`.
5. Si no: servir el archivo desde la ruta guardada con `Content-Type` según extensión y `Content-Disposition: attachment; filename="comprobante-<id>.<ext>"`. Si la ruta no existe en disco → 409 con el mismo mensaje del paso 4.

---

## 7. UI y Componentes

### 7.1 `/paciente/turnos/page.tsx` (Server Component)

- `requireRole("PACIENTE")`.
- Cargar `cargarBeneficiarios(usuarioId)`. Si la lista está vacía (usuario sin perfil Paciente), renderizar el estado vacío: "No hay turnos próximos." con nota de que el perfil aún no está registrado (no romper la página).
- Leer `leerFiltrosTurnos(await props.searchParams)` y validar `beneficiario` contra la lista (si falta o no pertenece → primer beneficiario).
- Llamar `obtenerTurnosPaciente({ ...filtros, beneficiario })`.
- Renderizar `TurnosView` con `{ beneficiarios, beneficiarioSeleccionado, filtros, proximos, antecedentes }`.

### 7.2 `turnos-view.tsx` (Client Component)

Estructura (patrón visual de `agenda-view.tsx`, clases `.sigsam-*`):

- **Cabecera** (título/subtítulo de §3, ya presentes en el placeholder).
- **Selector de beneficiario**: `<select>` con opción por cada beneficiario (`"Nombre — Titular"` / `"Nombre — Menor a cargo"`). Cambiarlo reescribe la URL preservando los demás filtros (`router.replace` con query params).
- **Barra de filtros**: selects para Período (Próximos turnos / Antecedentes / Todos), Estado (Todos / Confirmado / Cancelado), Resultado (Todos / Sin resultado / Atendido / Ausente), Especialidad y Vacuna (cargadas desde los turnos recibidos o catálogo; ocultas según corresponda). Cada cambio reescribe la URL (patrón `construirUrl` de `agenda-view.tsx:32`).
- **Sección "Próximos turnos"**: filas con:
  - Prestación + profesional.
  - Fecha (`etiquetaFecha`) · hora · `HS`.
  - Badges: estado (`ETIQUETA_ESTADO_CITA`), resultado (`ETIQUETA_RESULTADO_ATENCION`), cobro (`Cobrada` / `Sin cobrar` / `Sin cobro al paciente`).
  - Si `pendienteDeResolver`: aviso con `MSG` de jornada suspendida (CA3).
  - Si tiene `reprogramadoDesdeId`: texto "Esta cita fue reprogramada." + vínculo "Ver cita original".
  - Si `reprogramada` (tiene turno nuevo): vínculo "Ver cita nueva".
  - Acciones: **Ver detalle** (Link a `/paciente/turnos/<id>`), **Cancelar** (solo si `cancelable`; abre confirmación → llama `cancelarTurnoPaciente` → `router.refresh()` y muestra `role="status"` con `MSG.CANCELACION_EXITO` o `role="alert"` con el error), **Descargar factura** (solo si `facturaDisponible`, `<a href="/api/paciente/turnos/[id]/comprobante" download>`).
  - Nota fija de plazo (`MSG` "Podés cancelar hasta 24 horas antes…") al pie de la sección.
- **Sección "Antecedentes"**: mismas filas, sin acción Cancelar; citas canceladas muestran fecha de cancelación si `canceladoEn` está disponible y el vínculo de reprogramación si aplica.
- Estados vacíos de §3 para cada sección.

### 7.3 `/paciente/turnos/[id]/page.tsx` (Server Component)

Patrón de `src/app/(app)/medico/turnos/[id]/page.tsx:9-24`:

1. `requireRole("PACIENTE")`.
2. Cargar turno con todos los `include` de §6.3.
3. `turno.pacienteId ∈ cargarBeneficiarios(usuarioId)`; si no → `notFound()` (CA5).
4. Vínculo "← Volver a Mis turnos".
5. **Sección Datos de la cita**: prestación, tipo, fecha (`etiquetaFecha`), horario, duración, profesional/especialidad, cobertura (snapshot `coberturaNombreSnapshot` o "Particular"), estado (badge), resultado (badge).
6. **Sección Estado de la jornada**: si `pendienteDeResolver`, aviso con `MSG` de jornada suspendida; si `motivoSuspension` existe, se muestra (es información de la propia cita del paciente).
7. **Sección Reprogramación**: vínculos "Ver cita nueva" / "Ver cita original" según corresponda (CA3).
8. **Sección Cobro** (CA4): etiqueta `situacionCobro`, arancel de la cita (`Turno.arancel`), y si `facturaDisponible` el botón "Descargar factura" hacia la API route; si hay comprobante sin archivo, `MSG.SIN_COMPROBANTE_ARCHIVO`.
9. **Sección Cancelar**: renderiza `CancelarCitaButton` solo cuando `puedeCancelarTurno` es true; caso contrario muestra el motivo (`MSG.CANCELACION_PLAZO` o `MSG.CANCELACION_ESTADO`). Si el turno ya está `CANCELADO`, se muestra el estado con su fecha y el vínculo de reprogramación.

### 7.4 `cancelar-cita-button.tsx` (Client Component)

- Botón "Cancelar cita" con `aria-describedby` a la nota de plazo.
- `confirm()` nativo o diálogo inline: "¿Cancelás esta cita? Esta acción no se puede deshacer."
- Estado `pending` en el botón (`disabled`, texto "Cancelando…").
- On success: `router.refresh()`, `role="status"` con `MSG.CANCELACION_EXITO`.
- On error: `role="alert"` con el mensaje devuelto.

---

## 8. Estilos y accesibilidad

- Colores y tokens de Tailwind v4 definidos en `globals.css`: Canvas `#f7f9fa`, Surface `#ffffff`, Line `#d7e2e4`, Ink `#18323a`, Brand `#145f65`.
- Usar las clases existentes: `sigsam-page-head`, `sigsam-eyebrow`, `sigsam-card`, `sigsam-empty`, `sigsam-notice info`, `sigsam-link`, `sigsam-btn` (revisar su uso en `agenda-view.tsx` y en `src/app/(app)/medico/turnos/[id]/page.tsx` antes de crear variantes).
- Todo control interactivo con alto mínimo de 44px (`min-h-[44px]`).
- Badges con `aria-label` que incluyan texto alternativo (ej. `aria-label="Estado: Confirmado"`).
- Mensajes de error `role="alert"` + `aria-invalid`; éxito `role="status"`.
- En móvil (<768px) las filas se apilan en tarjetas de bloque legible (patrón de tablas responsivas ya usado en el proyecto).

---

## 9. Datos de prueba / seed

Extender `prisma/seed.ts` de forma **idempotente** (upsert/early-return por claves naturales, patrón existente del archivo):

1. **Perfil Paciente** para `paciente@sigsam.local` (Juan Pérez): `personaId` del usuario demo → `paciente.create` con `dni`, `fechaNacimiento` de adulto y sin tutor (si ya existe, no tocar).
2. **Menor a cargo**: persona + usuario con `rol: "PACIENTE"` (ej. `menor@sigsam.local`, clave temporal) y fila `paciente` con `tutorId = personaId` de Juan Pérez y `fechaNacimiento` de menor, para probar el selector de beneficiarios (CA5).
3. **Disponibilidades** `PUBLICADA` del médico demo en fechas relativas (`hoy+3`, `hoy+10`, `hoy-14`, `hoy-30`) con `horaDesde`/`horaHasta` coherentes con duración 20 min.
4. **Una jornada `SUSPENDIDA`** (fecha `hoy+10`) con sus 3 campos obligatorios (`motivoSuspension`, `suspendidaEn`, `suspendidaPor`) para probar CA3.
5. **Turnos** (todos sobre el paciente Juan Pérez, `estado`/`resultado` variados):
   - Futuro `CONFIRMADO` en jornada PUBLICADA (cancelable, CA4).
   - Futuro `CONFIRMADO` dentro de 12 horas (NO cancelable por plazo, CA4).
   - Futuro `CONFIRMADO` en la jornada SUSPENDIDA (CA3).
   - Futuro `CONFIRMADO` `VACUNACION` con `vacunaId` (filtro por vacuna, CA1).
   - Pasado `CONFIRMADO` con `resultado: ATENDIDO` (CA2) + fila `comprobante_turno` con `archivoPrivado` + fila `pago_manual` `APROBADO` (CA4 "Cobrada", factura disponible).
   - Pasado `CONFIRMADO` con `resultado: AUSENTE` y `modalidad: PARTICULAR` sin pago (CA4 "Sin cobrar").
   - Pasado `CANCELADO` **reprogramado**: la cancelada tiene una fila nueva con `reprogramadoDesdeId` apuntando a ella (CA3).
   - Futuro `CONFIRMADO` con `modalidad: CON_COBERTURA` (CA4 "Sin cobro al paciente").
6. Respetar los CHECK de la migración: todo turno `CANCELADO` lleva `canceladoEn`, `canceladoPor` y `motivoCancelacion`; toda disponibilidad `SUSPENDIDA` lleva sus 3 campos.

---

## 10. Documentar la decisión

Agregar a `docs/DECISIONES.md`:

### D-20 — Consulta personal de turnos con cancelación a 24 horas
- **Estado:** Aceptada (2026-10-06)
- **Decisión:** El paciente/tutor consulta sus turnos desde `/paciente/turnos` con filtros por período, estado, resultado, especialidad y vacuna, siempre acotados al conjunto de beneficiarios autorizados (titular + menores a cargo) resueltos en servidor. La cancelación desde el portal exige 24 horas o más de anticipación sobre el instante de inicio de la cita (`puedeCancelarTurno`), se persiste con `origen_cancelacion = "paciente"` y queda auditada; los turnos cancelados nunca se eliminan (antecedente). La facturación es de solo lectura: la clasificación cobrado/sin cobrar/sin cobro se deriva de `modalidad` + `pago_manual`, y la descarga solo emite comprobantes ya existentes.
- **Motivo:** Cumplimiento de CA1–CA5 de US-SIG-013 y RF-02, manteniendo separación entre estado médico y cobro (inferencia de la US) y reutilizando `cargarBeneficiarios` como única fuente de autorización de acceso (CA5).

---

## 11. Orden de implementación

1. Extender `src/lib/auth/constants.ts` con `MSG` y `AUDITORIA` (§6.1).
2. Agregar `PLAZO_CANCELACION_MS` y `puedeCancelarTurno` en `src/lib/agenda/reglas.ts` (§6.2).
3. Crear `src/lib/turnos/consulta-turnos.ts` (§6.3).
4. Crear Server Action `src/app/actions/turnos-paciente.ts` (§6.4).
5. Crear API route de descarga `src/app/api/paciente/turnos/[id]/comprobante/route.ts` (§6.5).
6. Crear `turnos-view.tsx` (§7.2) y reemplazar `page.tsx` de la lista (§7.1).
7. Crear `cancelar-cita-button.tsx` (§7.4) y la ficha `[id]/page.tsx` (§7.3).
8. Extender `prisma/seed.ts` con datos de prueba (§9) y correr `npm run db:seed`.
9. Documentar D-20 en `docs/DECISIONES.md`.
10. Ejecutar compuertas automáticas (`format`, `lint`, `format:check`, `build`).
11. Realizar commit y merge a `stage`.

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

- **CA1.** Entrar como `paciente@sigsam.local` (`Paciente@1234`, puede requerir cambio de clave temporal) → `/paciente/turnos`:
  - Se ven solo turnos de Juan Pérez; cambiar el selector a "Menor a cargo" muestra solo los del menor (nunca cruzados).
  - Filtrar Período "Próximos turnos" → solo futuros; "Antecedentes" → solo pasados/cancelados.
  - Filtrar Estado "Cancelado" → solo cancelados; Resultado "Atendido" → solo atendidos.
  - Filtrar Especialidad "Clínica Médica" → excluye las vacunaciones; filtrar Vacuna "Antigripal" → excluye las consultas.
- **CA2.** Cada fila muestra prestación (especialidad o vacuna), fecha, horario, badge de estado y badge de resultado ("Sin resultado" / "Atendido" / "Ausente").
- **CA3.** El turno futuro en la jornada SUSPENDIDA muestra "Esta cita requiere resolución: la jornada está suspendida."; en la ficha se ve también el motivo de suspensión. La cita cancelada reprogramada muestra "Esta cita fue reprogramada." + "Ver cita nueva", y la nueva muestra "Ver cita original". Ninguna cita cancelada desaparece de Antecedentes.
- **CA4.** Sobre el turno futuro cancelable: botón Cancelar visible → confirmar → mensaje "Turno cancelado con éxito.", el turno pasa a Antecedentes como Cancelado y en la base aparece la fila de `auditoria` con acción `"Cancelación de turno por paciente"` y `origen_cancelacion = "paciente"`. Sobre el turno a 12 horas: el botón no aparece y la ficha muestra el mensaje de plazo. Facturas: el turno con comprobante + pago APROBADO muestra "Cobrada" y botón "Descargar factura" que descarga el archivo; el turno particular sin pago muestra "Sin cobrar" sin botón; el turno con cobertura muestra "Sin cobro al paciente".
- **CA5.** Con la URL directa `/paciente/turnos/<id>` de un turno que no es del beneficiario → 404. Entrar con otro rol (`medico@sigsam.local`) → `/sin-permiso` o su inicio. No hay en la pantalla ninguna métrica/agregado de otros pacientes.
- **Regresión.** `/paciente/buscar` y `/paciente/confirmar` siguen operando (no se tocó `reservas.ts`); la agenda médica (`/medico`) sigue funcionando (cambios en `reglas.ts` son aditivos).
