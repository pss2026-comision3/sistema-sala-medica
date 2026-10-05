# Plan de implementación — US-SIG-013 Consultar próximos turnos y antecedentes

Este archivo es la especificación detallada para implementar la historia **US-SIG-013** en SIGSAM. Sigue estrictamente el estándar de `docs/PLAN-US-001.md`, `docs/PLAN-US-006.md` y `docs/PLAN-US-007.md`. No agrega alcance innecesario. Si algo no está escrito acá, no lo inventes.

---

## 0. Qué hacer y qué no hacer

Implementar únicamente **US-SIG-013** (RF-02). Al terminar la implementación:

1. El **Paciente** (o el **Tutor**) accede a `/paciente/turnos` (enlace "Mis turnos" ya presente en la navegación del `AppShell`).
2. En la pantalla `/paciente/turnos`:
   - Ve sus citas **futuras** y **pasadas**, agrupadas en dos secciones: "Próximos turnos" y "Anteriores y cancelados".
   - Puede filtrar por **período** (desde / hasta), por **prestación** (consulta médica o vacunación, y dentro de cada una especialidad o vacuna) y por **estado**.
   - Si el usuario es **tutor** de uno o más menores, puede cambiar el **beneficiario** (Yo / cada menor a cargo / Todos) y las citas se muestran agrupadas por beneficiario.
3. Cada cita muestra: prestación, fecha, horario (inicio y fin), estado (**Confirmado** / **Cancelado**) y resultado de atención (**Sin registrar** / **Atendido** / **Ausente**), más la cobertura y el estado de cobro como etiquetas informativas.
4. Una cita cuyo profesional suspendió la jornada muestra la marca **"Requiere resolución"**. Una cita reprogramada conserva su antecedente (la cita cancelada que la originó) y enlaza a la cita nueva que la reemplazó.
5. Al abrir el detalle de una cita (`/paciente/turnos/[turnoId]`), el servidor **vuelve a verificar** que esa cita pertenece al paciente autenticado o a uno de sus menores a cargo; si no, la pantalla responde "no encontrada".
6. Se muestran avisos informativos de la regla de cancelación (24 h) y de la disponibilidad de facturas, **sin** ofrecer botones de acción: ni cancelación ni descarga de factura (son US-SIG-014 y US-SIG-030).
7. La interfaz funciona en navegador de escritorio y en pantallas móviles (ancho mínimo 390px).

### No hacer:

- **No** tocar `prisma/schema.prisma` ni crear migraciones: el modelo ya soporta todo lo necesario.
- **No** modificar `prisma/seed.ts` (decisión de equipo: los datos de prueba llegan con US-SIG-012).
- **No** implementar la cancelación de turnos (US-SIG-014, Sprint 2), la suspensión de jornadas (US-SIG-009, Sprint 2), la reprogramación (US-SIG-015, Sprint 2), los cobros (US-SIG-028/029, Sprint 3) ni la factura (US-SIG-030, Sprint 3). Esta US solo **muestra** el estado que esas historias producen.
- **No** permitir acceso a roles distintos de `PACIENTE` (los demás son redirigidos según corresponda).
- **No** mostrar turnos de otros pacientes, ni totales, promedios ni estadísticas de la sala (CA5).
- **No** mostrar citas en estado `RESERVADO` (son retenciones temporales de 5 minutos de otra sesión, no un turno consultable).
- **No** instalar dependencias adicionales.
- **No** escribir en la base desde esta historia: es de solo lectura.

---

## 1. Criterios de Aceptación (US-SIG-013)

Texto de la historia: *Como paciente o tutor, quiero consultar los turnos del beneficiario, para conocer sus próximas atenciones y el resultado de las anteriores.*
Preguntas relacionadas: P-09, P-11, P-23, P-32, P-55, P-57, P-60.

- **CA1.** Se muestran citas futuras y pasadas del registro Paciente autorizado, filtrables por período, especialidad o vacuna y estado.
- **CA2.** Cada cita identifica prestación, fecha, horario, estado Confirmado o Cancelado y resultado de atención Sin registrar, Atendido o Ausente.
- **CA3.** Las citas de jornadas suspendidas muestran que requieren resolución. Una reprogramación conserva el antecedente de cancelación y la relación con su nueva cita.
- **CA4.** Se ofrece cancelar cuando el plazo lo permite y descargar factura cuando exista. También se distingue prestación particular cobrada, sin cobrar o sin cobro al paciente.
- **CA5.** No se muestran otros pacientes ni estadísticas generales. El acceso del tutor se verifica nuevamente al abrir una cita.

Inferencias del documento de la Comisión: el acceso del paciente a los reportes de P-11 se concreta como **consulta personal**. Reserva, atención y cobro se presentan **por separado**, para evitar que un pago cambie el estado médico.

> **Alcance de CA4 en el Sprint 1.** La cancelación y la descarga de factura pertenecen a US-SIG-014 y US-SIG-030. En esta US el criterio se cumple en modo **lectura**: se informa la regla de los 24 h, se marca si el plazo ya venció y se distingue la situación de cobro según los datos que ya existen en `turno`, `pago_manual` y `comprobante_turno`.

---

## 2. Decisiones de diseño y arquitectura

| Tema | Decisión |
| --- | --- |
| **Ubicación de la funcionalidad** | Ruta protegida `/paciente/turnos` (dentro del grupo `(app)/paciente`, cuyo layout ya exige rol `PACIENTE`) y detalle en `/paciente/turnos/[turnoId]`. |
| **Cómo se filtran** | Por **query params** leídos en el Server Component (`?beneficiario=&tipo=&especialidad=&vacuna=&estado=&desde=&hasta=`) con un formulario `GET` sin JavaScript. El filtrado es autoritativo en servidor y la URL es compartible. |
| **Secciones de la vista** | 1) **Próximos turnos** (instante de inicio futuro y `estado = CONFIRMADO`) y 2) **Anteriores y cancelados** (todo lo demás). Es la partición del wireframe SC-07. |
| **Estados visibles** | Solo `CONFIRMADO` y `CANCELADO`, que son los que exige CA2. `RESERVADO` se excluye por decisión de alcance (retención de 5 min de otra sesión). |
| **Período por defecto** | Próximos: desde = hoy en la hora de la sala. Antecedentes: **sin límite inferior**, porque los filtros de período no eliminan información (el historial se conserva desde el inicio). |
| **Beneficiario (CA5)** | El paciente ve sus propias citas; el tutor ve las suyas **y** las de sus menores a cargo. `Paciente.tutorId` referencia `Paciente.personaId`, así que los menores a cargo son `paciente.findMany({ where: { tutorId: miPersonaId } })`. No hay un flag de "vínculo vigente": la existencia del vínculo es la autorización. |
| **Agrupación** | Cuando hay más de un beneficiario visible, las citas se agrupan por beneficiario con su nombre completo. |
| **Fecha del turno** | No existe en `Turno`: se compone con `Disponibilidad.fecha` (día de la jornada) + `Turno.hora` (hora del cupo). |
| **Especialidad** | No hay FK directa en `Turno`: se alcanza por `Turno.disponibilidadId → Disponibilidad.profesionalId → Medico.especialidadId`. |
| **Zona horaria** | La sala opera en `America/Argentina/Buenos_Aires` (sin horario de verano desde 2009, offset fijo **-03:00**). Todo cálculo de "futuro/pasado" y de plazos se hace con instantes compuestos en esa zona. |
| **Detalle de cita (CA5)** | Ruta propia con re-verificación en servidor: se consulta el turno con `id` **y** `pacienteId in (mis autorizados)`. Si no hay match → `notFound()` (no revela existencia). |
| **CA3 en lectura** | `requiereResolucion = disponibilidad.estado === "SUSPENDIDA" && estado === "CONFIRMADO"`. La reprogramación se muestra con las dos puntas de `Turno.reprogramadoDesdeId` / `Turno.reprogramaciones`. |
| **CA4 en lectura** | `estadoCobro` derivado de `pago_manual` (existe `APROBADO`), `modalidad` y `arancel`. `pdfDisponible = comprobantes.length > 0`. No hay botones de acción. |
| **Manejo de tipos BigInt y Decimal** | Los datos leídos de Prisma se serializan a `string` / `number` en DTOs planos antes de llegar a los componentes. |

---

## 3. Mensajes exactos (español)

Usar estos textos literales sin parafrasear:

| Caso | Texto |
| --- | --- |
| **Sin turnos propios** | Todavía no tenés turnos. Buscá un horario y reservá tu consulta. |
| **Filtro sin resultados** | No hay turnos que coincidan con los filtros aplicados. |
| **Sin menores a cargo** | Todavía no tenés menores a cargo vinculados. |
| **Cuenta sin ficha de paciente** | Tu cuenta no tiene un registro de paciente asociado. Contactá a Administración. |
| **Detalle no encontrado / no autorizado** | No encontramos la cita que pediste. |
| **Aviso CA3 — jornada suspendida** | Esta cita requiere resolución: la jornada del profesional fue suspendida. |
| **Aviso CA3 — cita reprogramada** | Esta cita fue reprogramada. El turno anterior queda conservado como antecedente. |
| **Aviso CA4 — regla de cancelación** | Podés cancelar un turno hasta 24 horas antes del inicio. Si falta menos tiempo, contactá a la sala. |
| **Aviso CA4 — factura** | Las facturas se habilitan en la etapa de cobros del proyecto. |
| **Plazo de cancelación vencido (por cita)** | Fuera del plazo de cancelación. |
| **Sin permiso (rol)** | Tu rol no tiene permiso para abrir esta pantalla. |
| **Listado recortado** | Se muestran los turnos más recientes. Usá los filtros de período para consultar el historial completo. |

Etiquetas de dominio (constantes, no mensajes de error):

| Dato | Etiqueta visible |
| --- | --- |
| `CONFIRMADO` | Confirmado |
| `CANCELADO` | Cancelado |
| `SIN_REGISTRAR` | Sin registrar |
| `ATENDIDO` | Atendido |
| `AUSENTE` | Ausente |
| `modalidad = PARTICULAR` | Particular |
| `modalidad = CON_COBERTURA` | Con cobertura |
| `estadoCobro = COBRADA` | Cobrada |
| `estadoCobro = SIN_COBRO_PACIENTE` | Sin cobro al paciente |
| `estadoCobro = SIN_COSTO` | Sin costo para el paciente |
| `estadoCobro = SIN_REGISTRAR` | Cobro no registrado |

---

## 4. Rutas y navegación

| URL | Acceso | Propósito |
| --- | --- | --- |
| `/paciente/turnos` | Solo `PACIENTE` | Listado de próximos turnos y antecedentes, con filtros y selector de beneficiario. |
| `/paciente/turnos/[turnoId]` | Solo `PACIENTE` (con re-verificación de beneficiario) | Detalle de una cita. Responde "no encontrada" si la cita no es del paciente ni de un menor a cargo. |
| `/paciente` | Solo `PACIENTE` | Incremento opcional de esta US: tarjeta "Tu próxima cita" en el inicio (wireframe SC-04), reutilizando `obtenerProximoTurno()`. |
| `/sin-permiso` | Otros roles autenticados | Pantalla estándar 403 si se intenta abrir con un rol distinto de `PACIENTE`. |
| `src/app/(app)/not-found.tsx` | — | Página de "no encontrado" con el estilo de la app para el `notFound()` del detalle. |

---

## 5. Árbol de archivos a crear o modificar

```
src/
  lib/
    auth/
      constants.ts                            # Etiquetas de estado/resultado/cobro, PLAZO_CANCELACION_HORAS y mensajes
    turnos/                                   # Módulo nuevo (no colisiona con US-011/US-012)
      presentacion.ts                         # Zona horaria, composición fecha+hora, formateo y etiquetas
      consulta.ts                             # Autorización de beneficiarios y consultas de lectura
  app/
    (app)/
      not-found.tsx                           # Página de "no encontrado" con estilo de la app
      paciente/
        page.tsx                              # (Opcional) Tarjeta "Tu próxima cita" — wireframe SC-04
        turnos/
          page.tsx                            # Server Component: lee searchParams, carga y agrupa
          mis-turnos-filtros.tsx              # Client Component: formulario GET de filtros
          [turnoId]/
            page.tsx                          # Detalle con re-verificación de beneficiario
docs/
  PLAN-US-013.md                              # Este documento de especificación
  DECISIONES.md                               # Registro de decisión D-20
```

No se modifica `prisma/schema.prisma` ni `prisma/seed.ts`.

---

## 6. Contratos de código

### 6.1 `src/lib/auth/constants.ts`

Agregar al final de los objetos existentes (para no colisionar con los mergeos de US-SIG-011/012):

```ts
export const PLAZO_CANCELACION_HORAS = 24;

export const ETIQUETA_ESTADO_TURNO = {
  CONFIRMADO: "Confirmado",
  CANCELADO: "Cancelado",
} as const;

export const ETIQUETA_RESULTADO = {
  SIN_REGISTRAR: "Sin registrar",
  ATENDIDO: "Atendido",
  AUSENTE: "Ausente",
} as const;

export const ETIQUETA_MODALIDAD = {
  PARTICULAR: "Particular",
  CON_COBERTURA: "Con cobertura",
} as const;

export const ETIQUETA_COBRO = {
  COBRADA: "Cobrada",
  SIN_COBRO_PACIENTE: "Sin cobro al paciente",
  SIN_COSTO: "Sin costo para el paciente",
  SIN_REGISTRAR: "Cobro no registrado",
} as const;

export const MSG = {
  // ... existentes ...
  TURNOS_VACIOS: "Todavía no tenés turnos. Buscá un horario y reservá tu consulta.",
  TURNOS_SIN_COINCIDENCIAS:
    "No hay turnos que coincidan con los filtros aplicados.",
  SIN_MENORES_A_CARGO: "Todavía no tenés menores a cargo vinculados.",
  PACIENTE_SIN_FICHA:
    "Tu cuenta no tiene un registro de paciente asociado. Contactá a Administración.",
  TURNO_NO_ENCONTRADO: "No encontramos la cita que pediste.",
  TURNO_REQUIERE_RESOLUCION:
    "Esta cita requiere resolución: la jornada del profesional fue suspendida.",
  TURNO_REPROGRAMADO:
    "Esta cita fue reprogramada. El turno anterior queda conservado como antecedente.",
  AVISO_CANCELACION:
    "Podés cancelar un turno hasta 24 horas antes del inicio. Si falta menos tiempo, contactá a la sala.",
  AVISO_FACTURA: "Las facturas se habilitan en la etapa de cobros del proyecto.",
  PLAZO_CANCELACION_VENCIDO: "Fuera del plazo de cancelación.",
  TURNOS_RECORTADOS:
    "Se muestran los turnos más recientes. Usá los filtros de período para consultar el historial completo.",
} as const;
```

### 6.2 `src/lib/turnos/presentacion.ts`

Zona horaria y composición de la fecha de la cita. **Ojo con la trampa**: `Disponibilidad.fecha` es un `@db.Date` que Prisma devuelve a medianoche **UTC**; formatearlo con `timeZone: "America/Argentina/Buenos_Aires"` devuelve el día anterior. Por eso las partes de la fecha se extraen con los getters **UTC**, y recién el instante compuesto se formatea con `Intl`.

```ts
import {
  ETIQUETA_COBRO,
  ETIQUETA_ESTADO_TURNO,
  ETIQUETA_MODALIDAD,
  ETIQUETA_RESULTADO,
} from "@/lib/auth/constants";

export const ZONA_SALA = "America/Argentina/Buenos_Aires";
export const OFFSET_SALA = "-03:00"; // Argentina no tiene horario de verano desde 2009.

type EstadoTurno = keyof typeof ETIQUETA_ESTADO_TURNO;
type ResultadoAtencion = keyof typeof ETIQUETA_RESULTADO;
type EstadoCobro = keyof typeof ETIQUETA_COBRO;

/** Compone `Disponibilidad.fecha` (date UTC) + `Turno.hora` (time con base 1970-01-01 UTC). */
export function instanteDeCita(fecha: Date, hora: Date): Date {
  const y = fecha.getUTCFullYear();
  const m = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  const d = String(fecha.getUTCDate()).padStart(2, "0");
  const hh = String(hora.getUTCHours()).padStart(2, "0");
  const mm = String(hora.getUTCMinutes()).padStart(2, "0");
  return new Date(`${y}-${m}-${d}T${hh}:${mm}:00${OFFSET_SALA}`);
}

export function sumarMinutos(instante: Date, minutos: number): Date {
  return new Date(instante.getTime() + minutos * 60_000);
}

/** "lunes, 5 de octubre de 2026" */
export function formatearFechaLarga(instante: Date): string;

/** "05/10/2026" — para filtros y valores yyyy-mm-dd */
export function formatearFechaCorta(instante: Date): string;

/** "08:00" */
export function formatearHora(instante: Date): string;

/** "08:00 a 08:20" (usa `Turno.duracionMin`) */
export function formatearRango(
  fecha: Date,
  hora: Date,
  duracionMin: number,
): string;

export function etiquetaEstado(estado: EstadoTurno): string;
export function etiquetaResultado(resultado: ResultadoAtencion): string;
export function etiquetaModalidad(modalidad: keyof typeof ETIQUETA_MODALIDAD): string;
export function etiquetaCobro(estado: EstadoCobro): string;
export function esProximo(instante: Date, ahora: Date): boolean;
```

Todas las formateaciones de fecha y hora usan `Intl.DateTimeFormat("es-AR", { timeZone: ZONA_SALA, ... })` sobre el instante ya compuesto, igual que hace `src/app/(app)/admin/pacientes/page.tsx`.

### 6.3 `src/lib/turnos/consulta.ts`

```ts
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { SesionActual } from "@/lib/auth/session";
import { MSG, PLAZO_CANCELACION_HORAS } from "@/lib/auth/constants";
import {
  instanteDeCita,
  sumarMinutos,
  formatearFechaCorta,
  formatearFechaLarga,
  formatearHora,
  formatearRango,
  etiquetaEstado,
  etiquetaResultado,
  etiquetaModalidad,
} from "@/lib/turnos/presentacion";

const MAX_TURNOS = 200;

export type FiltrosTurnos = {
  beneficiario: string;   // "TODOS" | personaId
  tipo: "TODOS" | "CONSULTA" | "VACUNACION";
  especialidadId: string; // "" = todas
  vacunaId: string;       // "" = todas
  estado: "TODOS" | "CONFIRMADO" | "CANCELADO";
  desde: string;          // "" o yyyy-MM-dd
  hasta: string;          // "" o yyyy-MM-dd
};

export type TurnoItem = {
  id: string;
  tipo: "CONSULTA" | "VACUNACION";
  prestacion: string;
  profesional: string | null;
  fecha: string;          // yyyy-MM-dd
  fechaLarga: string;
  hora: string;           // "08:00"
  rango: string;          // "08:00 a 08:20"
  duracionMin: number;
  arancel: number;
  modalidad: "PARTICULAR" | "CON_COBERTURA";
  cobertura: string | null;
  estado: "CONFIRMADO" | "CANCELADO";
  estadoEtiqueta: string;
  resultado: "SIN_REGISTRAR" | "ATENDIDO" | "AUSENTE";
  resultadoEtiqueta: string;
  estadoCobro: "COBRADA" | "SIN_COBRO_PACIENTE" | "SIN_COSTO" | "SIN_REGISTRAR";
  estadoCobroEtiqueta: string;
  requiereResolucion: boolean;
  avisoSuspension: string | null;
  reprogramadoDesdeId: string | null;
  citaRelacionadaId: string | null;
  avisoReprogramacion: string | null;
  origenCancelacion: string | null;
  motivoCancelacion: string | null;
  canceladoEn: string | null;
  plazoCancelacionVencido: boolean;
  pdfDisponible: boolean;
  proximo: boolean;
  beneficiarioNombre: string;
};

export type Beneficiario = { personaId: string; nombre: string; esPropio: boolean };

/** Catálogos que necesita el formulario de filtros para armar sus `select`. */
export type CatalogosTurnos = {
  especialidades: { id: string; nombre: string }[];
  vacunas: { id: string; nombre: string }[];
};

/** Identificadores de `Paciente.personaId` que el usuario autenticado puede ver: el propio + sus menores a cargo. */
export async function resolverBeneficiarios(
  sesion: SesionActual,
): Promise<Beneficiario[]>;

export async function cargarCatalogosTurnos(): Promise<CatalogosTurnos>;

/** Filtros por defecto cuando no hay query params. */
export function filtrosPorDefecto(beneficiarios: Beneficiario[]): FiltrosTurnos;

/** Convierte `searchParams` en `FiltrosTurnos`, validando cada valor contra los catálogos reales. */
export async function parseFiltrosTurnos(
  searchParams: Record<string, string | string[] | undefined>,
  sesion: SesionActual,
): Promise<{ filtros: FiltrosTurnos; catalogos: CatalogosTurnos }>;

export async function listarTurnos(
  sesion: SesionActual,
  filtros: FiltrosTurnos,
): Promise<{ turnos: TurnoItem[]; recortado: boolean; proximos: TurnoItem[]; historicos: TurnoItem[] }>;

/** Detalle. Aplica `pacienteId in (autorizados)`; si no hay match, `notFound()`. */
export async function obtenerTurno(
  sesion: SesionActual,
  turnoId: string,
): Promise<TurnoItem & { avisoFactura: string; beneficiarioNombre: string }>;

/** Usado por `/paciente` (SC-04). Devuelve `null` si no hay cita futura confirmada. */
export async function obtenerProximoTurno(
  sesion: SesionActual,
): Promise<TurnoItem | null>;
```

Reglas de implementación de `listarTurnos`:

1. `const autorizados = await resolverBeneficiarios(sesion)`; si la lista está vacía, devolver el estado "cuenta sin ficha de paciente" sin tocar la base.
2. Construir el filtro:
   - `pacienteId`: `{ in: autorizadosIds }`, o `{ equals: BigInt(filtros.beneficiario) }` si el beneficiario no es `"TODOS"` (validando que esté en la lista de autorizados; si no, `"TODOS"`).
   - `estado`: `"TODOS"` → `{ in: ["CONFIRMADO", "CANCELADO"] }`; si no, el valor literal.
   - `tipo`: `"TODOS"` | `"CONSULTA"` | `"VACUNACION"`.
   - `especialidadId` (solo con `tipo = "CONSULTA"`): `{ disponibilidad: { profesional: { medico: { is: { especialidadId: BigInt(...) } } } } }`.
   - `vacunaId` (solo con `tipo = "VACUNACION"`): `{ equals: BigInt(...) }`.
   - Período: `{ disponibilidad: { fecha: { gte?: Date; lte?: Date } } }` con `new Date("yyyy-MM-ddT00:00:00.000Z")`.
   - Nunca filtrar por `retenidoHasta` ni incluir `RESERVADO`.
3. `include`: `paciente.persona.nombreCompleto`, `disponibilidad` con `profesional.persona.nombreCompleto`, `disponibilidad.profesional.medico.especialidad.nombre`, `vacuna.nombre`, `pagos.estado`, `comprobantes.id`, `reprogramadoDesde.id`, `reprogramaciones.id`.
4. `orderBy: [{ disponibilidad: { fecha: "asc" } }, { hora: "asc" }]`, `take: MAX_TURNOS + 1` para saber si hubo recorte.
5. Mapear cada fila al DTO `TurnoItem` (BigInt → `String`, `Decimal` → `Number`) y partir en `proximos` / `historicos` comparando `instanteDeCita(fecha, hora)` con `new Date()`.
6. `requiereResolucion = disponibilidad.estado === "SUSPENDIDA" && estado === "CONFIRMADO"`.
7. `plazoCancelacionVencido = estado === "CONFIRMADO" && instante < ahora + 24 h`.
8. `estadoCobro`: `pagos.some(p => p.estado === "APROBADO") ? "COBRADA" : modalidad === "CON_COBERTURA" ? "SIN_COBRO_PACIENTE" : arancel === 0 ? "SIN_COSTO" : "SIN_REGISTRAR"`.
9. Mapear `prestacion` = `vacuna?.nombre ?? especialidad?.nombre ?? "Consulta médica"`.

---

## 7. UI y Componentes

### 7.1 `/paciente/turnos/page.tsx`

- `await requireRole("PACIENTE")` (el layout del grupo también lo exige; se repite por patrón del resto de las páginas).
- Leer `searchParams` (en Next 16 es una `Promise`; usar `PageProps<"/paciente/turnos">`).
- `await parseFiltrosTurnos(...)` y `await listarTurnos(...)`.
- Renderizar cabecera, avisos de reglas de negocio, `MisTurnosFiltros` y las dos secciones de listado.
- Si `beneficiarios.length === 0`, mostrar `sigsam-empty` con `MSG.PACIENTE_SIN_FICHA`.

### 7.2 `mis-turnos-filtros.tsx` (Client Component)

Formulario `GET` apuntando a `/paciente/turnos` (sin Server Actions: los filtros son una consulta, no una mutación).

- **Beneficiario** (`select`): "Yo", cada menor a cargo, "Todos". Visible solo si hay más de un beneficiario.
- **Tipo de prestación** (`select`): Todas / Consultas médicas / Vacunación.
- **Especialidad** (`select`): todas las especialidades activas; se muestra solo si `tipo = CONSULTA`.
- **Vacuna** (`select`): todas las vacunas activas; se muestra solo si `tipo = VACUNACION`.
- **Estado** (`select`): Todos / Confirmado / Cancelado.
- **Período**: dos `input type="date"` (`desde`, `hasta`).
- Botones "Aplicar filtros" (`type="submit"`) y "Limpiar" (`href="/paciente/turnos"`).
- Todos los controles con `min-h-[44px]` y `<label>` asociado.

### 7.3 Secciones de listado

- **Próximos turnos**: orden ascendente. Cada fila: prestación (con `profesional`), `fechaLarga`, `rango`, `estadoEtiqueta`, `resultadoEtiqueta`, `modalidad` + `cobertura`, `estadoCobroEtiqueta`, beneficiario si hay más de uno, y el enlace "Ver detalle".
  - Si `requiereResolucion`, mostrar `sigsam-notice warning` con `MSG.TURNO_REQUIERE_RESOLUCION`.
  - Si `plazoCancelacionVencido`, etiqueta `MSG.PLAZO_CANCELACION_VENCIDO`.
  - Vacío: `sigsam-empty` con `MSG.TURNOS_VACIOS` y enlace a `/paciente/buscar`.
- **Anteriores y cancelados**: orden descendente. Cada fila: prestación, `fechaLarga`, `rango`, `estadoEtiqueta`, `resultadoEtiqueta`, `estadoCobroEtiqueta`, y si `estado = CANCELADO`, `origenCancelacion`, `motivoCancelacion` y `canceladoEn`.
  - Con `reprogramadoDesdeId`: aviso `MSG.TURNO_REPROGRAMADO` + enlace "Ver la cita nueva".
  - Con `citaRelacionadaId` (esta cita fue reemplazada por otra): enlace "Ver el turno anterior".
  - Vacío: `sigsam-empty` con un texto propio de sección.
- Cuando el filtro no arroja nada en ninguna sección: `MSG.TURNOS_SIN_COINCIDENCIAS`.
- Si `recortado`, mostrar `MSG.TURNOS_RECORTADOS`.

### 7.4 Avisos de negocio (una vez, arriba de la lista)

- `sigsam-notice info` con `MSG.AVISO_CANCELACION` (CA4).
- `sigsam-notice info` con `MSG.AVISO_FACTURA` (CA4).

### 7.5 `/paciente/turnos/[turnoId]/page.tsx`

- `requireRole("PACIENTE")` y `await obtenerTurno(sesion, params.turnoId)`.
- Encabezado con prestación, beneficiario, `fechaLarga` y `rango`.
- Bloque de estado: `estadoEtiqueta` + `resultadoEtiqueta` + `modalidad` + `cobertura` + `estadoCobroEtiqueta` + `arancel` formateado (`$5.000,00`).
- Si `requiereResolucion`, `sigsam-notice warning`. Si hubo cancelación, motivo, origen y fecha. Si hubo reprogramación, el enlace a la cita relacionada.
- Si `pdfDisponible`, indicar `MSG.AVISO_FACTURA` (sin botón de descarga).
- Enlace "Volver a mis turnos".
- `notFound()` cae en `src/app/(app)/not-found.tsx`, que muestra `MSG.TURNO_NO_ENCONTRADO` con enlace a `/paciente/turnos`.

### 7.6 `/paciente/page.tsx` (incremento opcional, wireframe SC-04)

- Reemplazar el `sigsam-empty` actual por una tarjeta "Tu próxima cita" con `obtenerProximoTurno()`: prestación, profesional, `fechaLarga`, `rango`, `estadoEtiqueta` y enlace "Ver detalle" hacia `/paciente/turnos/[id]`.
- Si no hay cita futura, `sigsam-empty` con `MSG.TURNOS_VACIOS` y enlace a `/paciente/buscar`.

---

## 8. Estilos y accesibilidad

- Colores y tokens de Tailwind v4 definidos en `globals.css`: Canvas `#f7f9fa`, Surface `#ffffff`, Line `#d7e2e4`, Ink `#18323a`, Brand `#145f65`.
- Todos los inputs, selects y botones interactivos deben tener un alto mínimo de 44px (`min-h-[44px]`).
- Cada sección de listado es una `section` con `sigsam-section-head` y una `sigsam-card`.
- Los mensajes de error / "no encontrado" utilizan `role="alert"`; los avisos informativos y estados vacíos, `role="status"`.
- El estado y el resultado de cada cita se comunican **con texto**, no solo con color; el color es un refuerzo.
- En dispositivos móviles (<768px) cada cita se muestra como bloque apilado (etiqueta + valor) con el enlace "Ver detalle" de tamaño táctil.

---

## 9. Datos de prueba / seed

**No modificar `prisma/seed.ts`.** US-SIG-011 y US-SIG-012 todavía no están implementadas y son las que crean disponibilidad y reservas; los datos de prueba llegan con ellas.

Para poder verificar esta US mientras tanto, se permite **a título local y sin commitear** insertar filas con Prisma Studio (`npm run db:studio`):

1. Dos `Disponibilidad` del profesional `medico@sigsam.local` (una con `fecha` futura y `horaDesde` / `horaHasta`, otra con `fecha` pasada).
2. Un `Turno` `CONFIRMADO` futuro y un `Turno` `CONFIRMADO` pasado con `resultado = ATENDIDO` para `paciente@sigsam.local`.
3. Un `Turno` `CANCELADO` pasado y, si se quiere probar CA3, un `Turno` `CONFIRMADO` sobre una disponibilidad con `estado = SUSPENDIDA`.
4. Un menor con `tutorId` apuntando al `personaId` del paciente, y un `Turno` suyo, para probar el selector de beneficiario.

Ninguna de esas inserciones forma parte del entregable de US-SIG-013.

---

## 10. Documentar la decisión

Agregar a `docs/DECISIONES.md`:

### D-20 — Consulta de turnos del beneficiario con re-verificación de tutor

- **Estado:** Aceptada (2026-10-05)
- **Decisión:** La pantalla `/paciente/turnos` es de **solo lectura** y muestra las citas del paciente autenticado y de sus menores a cargo, agrupadas en "Próximos turnos" y "Anteriores y cancelados", filtrables por período, prestación (consulta o vacunación, con especialidad o vacuna) y estado. Los filtros viajan por query params y se resuelven en el servidor. La fecha de cada cita se compone con `Disponibilidad.fecha` + `Turno.hora` e interpretada en `America/Argentina/Buenos_Aires` (offset fijo -03:00). El detalle vive en `/paciente/turnos/[turnoId]` y vuelve a verificar la autorización en servidor: el turno se busca siempre con `pacienteId in (beneficiarios autorizados)` y, si no hay coincidencia, se responde `notFound()`. Se excluyen los turnos en estado `RESERVADO` porque son retenciones temporales de 5 minutos de otra sesión. Las marcas de jornada suspendida, de reprogramación y de estado de cobro se **leen** de `disponibilidad.estado`, `turno.reprogramado_desde_id`, `pago_manual` y `comprobante_turno`, sin escribir en la base.
- **Motivo:** Cumplimiento de CA1, CA2, CA3, CA4 y CA5 de US-SIG-013 y RF-02, con los permisos verificados en cada apertura (P-53, P-61).
- **Consecuencias:**
  - No se agregan migraciones ni dependencias.
  - No se muestran otros pacientes, totales ni estadísticas de la sala.
  - Los filtros de período no eliminan información: el historial se conserva desde el inicio.
  - La cancelación (US-SIG-014), la suspensión (US-SIG-009), la reprogramación (US-SIG-015), los cobros (US-SIG-028/029) y la factura (US-SIG-030) quedan fuera de alcance y solo se anticipan con avisos y etiquetas informativas.

---

## 11. Orden de implementación

1. Agregar `PLAZO_CANCELACION_HORAS`, las tablas de etiquetas y los mensajes en `src/lib/auth/constants.ts`.
2. Crear `src/lib/turnos/presentacion.ts` (zona horaria, composición de instante, formateo, etiquetas).
3. Crear `src/lib/turnos/consulta.ts` (beneficiarios, parseo de filtros, listado, detalle, próximo turno).
4. Actualizar `src/app/(app)/paciente/turnos/page.tsx`.
5. Crear `src/app/(app)/paciente/turnos/mis-turnos-filtros.tsx`.
6. Crear `src/app/(app)/paciente/turnos/[turnoId]/page.tsx` y `src/app/(app)/not-found.tsx`.
7. (Opcional) Actualizar `src/app/(app)/paciente/page.tsx` con la tarjeta "Tu próxima cita".
8. Documentar la decisión D-20 en `docs/DECISIONES.md`.
9. Ejecutar compuertas automáticas (`format`, `lint`, `format:check`, `build`).
10. Realizar commit y merge a `stage`.

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

> Requiere que existan citas para el paciente de prueba. Si US-SIG-012 todavía no está integrada, usar los datos locales de la sección 9 (sin commitear).

Entrar como Paciente (`paciente@sigsam.local`).

- **CA1.**
  - La pantalla muestra las secciones "Próximos turnos" y "Anteriores y cancelados".
  - Aplicar el filtro de período (por ejemplo, "hoy") y verificar que la lista se acota; quitarlo y comprobar que vuelve el historial completo.
  - Filtrar por `Vacunación` y por una vacuna concreta; luego por `Consultas médicas` y por una especialidad.
  - Filtrar por estado "Confirmado" y por "Cancelado".
  - Cada filtro se refleja en la URL y la vista sobrevive a un F5.
- **CA2.** Cada fila muestra prestación, fecha, horario (inicio y fin), estado y resultado de atención, con los textos exactos de la sección 3.
- **CA3.**
  - Una cita `CONFIRMADO` sobre una disponibilidad con `estado = SUSPENDIDA` muestra "Esta cita requiere resolución: la jornada del profesional fue suspendida."
  - Una cita cancelada que originó una reprogramación muestra "Esta cita fue reprogramada…" con enlace a la cita nueva; la cita nueva enlaza de vuelta al antecedente.
- **CA4.**
  - Con `pago_manual` en estado `APROBADO`, la cita muestra la etiqueta "Cobrada".
  - Con `modalidad = CON_COBERTURA`, muestra "Con cobertura" y "Sin cobro al paciente".
  - Con `arancel = 0`, muestra "Sin costo para el paciente".
  - Con un comprobante generado, la cita indica la disponibilidad de factura.
  - En la lista y en el detalle aparece el aviso de las 24 h; **no** hay ningún botón de cancelar ni de descargar.
  - Una cita `CONFIRMADO` con menos de 24 h muestra la etiqueta "Fuera del plazo de cancelación".
- **CA5.**
  - Como paciente, no aparece ningún turno ajeno ni ninguna estadística de la sala.
  - Ingresar a mano `/paciente/turnos/[id]` con el id de una cita de otro paciente → "No encontramos la cita que pediste."
  - Con un menor a cargo vinculado, el selector de beneficiario ofrece "Yo", el menor y "Todos"; al elegir el menor solo se ven sus citas.
  - Al abrir el detalle de una cita del menor a cargo se accede normalmente (la verificación se repite y autoriza).
  - Ingresar con rol `ADMIN`, `MEDICO` o `ENFERMERIA` a `/paciente/turnos` → redirigido según el control de roles.
- **Responsive.** En 390px de ancho las citas se apilan en bloques legibles y los controles mantienen 44px de alto.
