# Plan de implementación — US-SIG-033 Consultar avisos dentro del sistema

Este documento especifica la arquitectura, diseño, reglas de negocio y estrategia de pruebas para implementar **US-SIG-033** en SIGSAM.

> **Estado:** Plan actualizado post-commit US-031 (`287089d`). Rama de trabajo: `feature/us-033-bandeja-avisos` (desde `stage`).

---

## Qué trajo el commit de US-031 (impacto directo en este plan)

El merge `287089d` incorporó la capa de emails reales. Esto cambia el punto de partida de US-033:

| Archivo nuevo | Relevancia para US-033 |
| --- | --- |
| `src/lib/email/mailer.ts` | Transporter Nodemailer singleton vía variables SMTP. Ya instalado. |
| `src/lib/email/templates.ts` | Plantillas `emailConfirmacion`, `emailCancelacion`, `emailSuspension`. Exposición del tipo `DatosCita`. |
| `src/lib/email/enviar-aviso.ts` | `enviarAvisoEmail()` fire-and-forget con reintento a 5 min. **Garantiza CA5**: nunca lanza ni revierte la transacción. |
| `src/lib/notificaciones/email-turno.ts` | `notificarPorEmail()` (llamada en las actions) y **`destinatarioDeTurno()`** — resuelve el usuario receptor (paciente activo o tutor vigente) para un turno dado. **Reutilizable para la verificación de enlace CA2/CA3**. |

**Patrones establecidos que US-033 debe respetar:**
1. `notificarPorEmail()` se llama sin `await` **después** de que la transacción de BD commitió.
2. El aviso interno (`AvisoInterno`) se crea **dentro** de la transacción; el email se dispara **fuera**. Eso garantiza que un email fallido nunca borra el aviso (CA5 resuelto por arquitectura).
3. `destinatarioDeTurno(tx, turnoId)` retorna `{ usuarioId, email }` o `null` si el paciente no tiene cuenta activa ni tutor vigente. US-033 puede reusar esta función para decidir si mostrar el enlace a la cita.

**Lo que US-031 NO implementó** (queda para US-033):
- Las funciones de lectura `obtenerBandejaAvisos()` y `contarAvisosNoLeidos()`.
- El stub `/paciente/avisos/page.tsx` sigue siendo un placeholder.
- Las páginas de bandeja para MEDICO, ENFERMERIA y ADMIN no existen.
- Las Server Actions de marcado como leído no existen.
- El badge de no leídos en el `AppShell` no existe.

---

## 0. Qué hacer y qué no hacer

### Qué hacer:
1. **Todos los roles** (PACIENTE, MÉDICO, ENFERMERÍA, ADMIN) acceden a **su propia bandeja** en `/[rol]/avisos`.
2. La bandeja muestra avisos ordenados **por fecha descendente**, con: evento, resumen, estado Leído/No leído, fecha y hora, y enlace a la cita cuando corresponda.
3. Marcar como leído actualiza `leido = true` en `AvisoInterno` — **solo para el usuario autenticado** (CA2).
4. Si el vínculo de tutor fue retirado, el enlace a la ficha del menor no se muestra; solo el resumen genérico (CA3). Usar `destinatarioDeTurno()` para la verificación.
5. Enfermería recibe sus alertas de inventario (`turnoId = null`). Pacientes reciben avisos de sus reservas y los de sus menores a cargo (CA4).
6. La garantía CA5 (email fallido no elimina aviso interno) ya está resuelta por la arquitectura de US-031. No implementar nada adicional para eso.
7. Registrar **auditoría** solo para "marcar todos como leídos" (masivo).
8. El `AppShell` muestra badge con conteo de no leídos, recalculado en SSR en cada navegación.

### Qué no hacer:
- **No** crear bandeja distinta por tipo de evento.
- **No** eliminar avisos — solo marcar como leídos.
- **No** habilitar chat ni mensajería libre (CA5).
- **No** omitir verificación de autorización en el enlace a la cita (CA2).
- **No** mostrar datos del menor si la tutoría ya no es vigente (CA3).
- **No** modificar `prisma/schema.prisma` — `AvisoInterno` ya existe.
- **No** instalar dependencias adicionales — `nodemailer` ya está, no se necesita nada más.
- **No** acceder a avisos de otro usuario aunque se conozca el ID.

---

## 1. Criterios de Aceptación (US-SIG-033)

> **Como** usuario, **quiero** consultar mis notificaciones y marcarlas como leídas, **para** revisar los avisos que requieren mi atención.
>
> **Preguntas relacionadas:** P-22, P-36, P-37, P-44, P-64.

- **CA1.** Cada cuenta tiene una bandeja propia ordenada por fecha, con evento, resumen y estado Leído o No leído.
- **CA2.** Abrir un aviso o marcarlo como leído afecta solo al Usuario. El enlace a una cita exige conservar autorización sobre el registro Paciente correspondiente.
- **CA3.** Si se retira un vínculo de tutor, los avisos previos no permiten acceder a la ficha del paciente menor; se conserva solo un resumen genérico sin sus datos identificatorios.
- **CA4.** Enfermería recibe sus alertas de inventario. Los pacientes reciben avisos sobre sus reservas y las de los menores que representan, no alertas de stock.
- **CA5.** Un email fallido no elimina el aviso interno. La bandeja no incorpora chat, respuestas a otros usuarios ni envío de mensajes libres. *(Garantizado por arquitectura de US-031: AvisoInterno se crea en la transacción; el email se dispara fire-and-forget después.)*

---

## 2. Dependencias

| Dependencia | Estado |
| --- | --- |
| **US-SIG-031** — infraestructura de avisos internos y emails | ✅ Mergeada en `stage` (`287089d`) |
| **US-SIG-032** — recordatorios 24h como `AvisoInterno` | Pendiente; cuando se implemente, aparecerá automáticamente en la bandeja |
| **US-SIG-027** — alertas de stock bajo como `AvisoInterno` para Enfermería | Pendiente Sprint 3; cuando se implemente, aparecerá automáticamente |
| **`src/lib/notificaciones/avisos.ts`** — funciones de escritura | ✅ Implementadas (`crearAvisoCancelacion`, `crearAvisoConfirmacion`, `crearAvisoSuspension`, `crearAvisoReprogramacion`) |
| **`src/lib/notificaciones/email-turno.ts`** — `destinatarioDeTurno()` | ✅ Disponible; reutilizar para verificación CA2/CA3 |
| **`prisma/schema.prisma`** — modelo `AvisoInterno` | ✅ Existe; sin migración requerida |
| **`nodemailer`** | ✅ Instalado en `package.json` |
| **D-03 (Prisma 7)** | ✅ Acceso a datos únicamente mediante Prisma |
| **D-13 (Ramas)** | Trabajar en `feature/us-033-bandeja-avisos` desde `stage` |

### Nota sobre `detalleUrl` en emails (US-031)

En `email-turno.ts`, `detalleUrl` apunta a `/paciente/turnos` (listado genérico), no al turno específico. US-033 proporciona el enlace profundo `/[rol]/turnos/[id]` dentro de la bandeja interna. Son capas complementarias: el email lleva al usuario al sistema; la bandeja lleva al turno exacto.

---

## 3. Decisiones de diseño y arquitectura

| Tema | Decisión |
| --- | --- |
| **Rutas por rol** | Cada rol tiene su propia página. Actualmente solo existe `/paciente/avisos` (stub). Se crean `/medico/avisos`, `/enfermeria/avisos` y `/admin/avisos`. |
| **Server Component + Server Action** | La página es un Server Component (carga inicial). El marcado como leído se hace vía Server Action desde un Client Component con `useTransition`. |
| **Marcar individualmente vs. masivo** | Botón "Marcar como leído" por aviso no leído + botón "Marcar todos". El masivo registra auditoría; el individual no. |
| **Badge en AppShell** | `AppShell` recibe `avisosNoLeidos: number` calculado en SSR en el layout. Se refresca en cada navegación. |
| **Verificación de enlace a cita (CA2, CA3)** | Reutilizar `destinatarioDeTurno(prisma, turnoId)` de `email-turno.ts`. Si retorna `null` (tutor retirado, paciente sin cuenta) o el `usuarioId` resultante no coincide con el usuario autenticado, se omite el enlace y se muestra solo el resumen. |
| **CA3 — Tutor retirado** | La función `destinatarioDeTurno` ya resuelve esto: busca el paciente activo o tutor vigente. Si el tutor fue desvinculado, retorna `null` → no se muestra el enlace. |
| **Paginación** | Primera versión sin paginación. Se puede agregar cursor-based pagination en iteraciones futuras. |
| **Sin cambios de esquema** | El modelo `AvisoInterno` ya existe. No se requiere migración. |
| **Auditoría** | Solo "Marcar todos como leídos" registra `AUDITORIA.MARCAR_AVISOS_LEIDOS`. |
| **CA5 garantizada por arquitectura** | `AvisoInterno` se crea dentro de la transacción de BD. `notificarPorEmail()` se llama sin `await` después del commit. `enviarAvisoEmail()` nunca lanza. No hay nada extra que implementar para CA5. |

---

## 4. Mensajes exactos (español)

| Caso | Mensaje literal |
| --- | --- |
| **Página vacía** | No tenés avisos por el momento. |
| **Todo leído** | Todos tus avisos están leídos. |
| **Aviso marcado leído (individual)** | Aviso marcado como leído. |
| **Ya estaba leído** | Este aviso ya estaba marcado como leído. |
| **Marcar todos — éxito** | Todos los avisos fueron marcados como leídos. |
| **Marcar todos — sin pendientes** | No hay avisos sin leer. |
| **Error al marcar** | No se pudo actualizar el aviso. Intentá nuevamente. |
| **Sin permiso (rol)** | Tu rol no tiene permiso para ver esta bandeja. |
| **Aviso no encontrado** | El aviso no existe o no tenés acceso. |
| **Badge nav** | N (número entero, sin texto adicional; usar aria-label "N sin leer"); sin badge si N = 0; mostrar "99+" si N > 99. |
| **Estado No leído** | No leído |
| **Estado Leído** | Leído |
| **Botón marcar individual** | Marcar como leído |
| **Botón marcar todos** | Marcar todos como leídos |
| **Título de página** | Notificaciones |
| **Descripción (paciente)** | Revisá los avisos sobre tus reservas y las de tus pacientes a cargo. |
| **Descripción (otros roles)** | Revisá los avisos y alertas de tu cuenta. |
| **Enlace a cita** | Ver cita |

---

## 5. Rutas y navegación

| URL | Acceso | Propósito |
| --- | --- | --- |
| `/paciente/avisos` | Solo `PACIENTE` | Bandeja: confirmaciones, cancelaciones, suspensiones, reprogramaciones de sus turnos y los de sus menores. |
| `/medico/avisos` | Solo `MEDICO` | Bandeja: cancelaciones presenciales, reprogramaciones que le afectan. |
| `/enfermeria/avisos` | Solo `ENFERMERIA` | Bandeja: alertas de stock bajo (cuando US-027 esté activo). |
| `/admin/avisos` | Solo `ADMIN` | Bandeja: avisos administrativos. |
| `/api/avisos/[id]/leer` | Cualquier rol autenticado | `PATCH`: marca el aviso como leído verificando que pertenece al usuario de la sesión. |
| `/sin-permiso` | Otros roles | Redirección si se intenta acceder a una bandeja de otro rol. |

---

## 6. Árbol de archivos a crear o modificar

```
src/
  lib/
    notificaciones/
      avisos.ts              # MOD: agregar obtenerBandejaAvisos() y contarAvisosNoLeidos()
                             #      (reutiliza destinatarioDeTurno de email-turno.ts para CA2/CA3)
    auth/
      constants.ts           # MOD: agregar MSG.AVISOS_* y AUDITORIA.MARCAR_AVISOS_LEIDOS
  app/
    actions/
      avisos.ts              # NUEVO: marcarAvisoLeidoAction() y marcarTodosLeidosAction()
    api/
      avisos/
        [id]/
          leer/
            route.ts         # NUEVO: Route Handler PATCH
    (app)/
      layout.tsx             # MOD: llamar contarAvisosNoLeidos() y pasar resultado a AppShell
      paciente/
        avisos/
          page.tsx           # MOD: reemplazar stub por implementación real
      medico/
        avisos/
          page.tsx           # NUEVO
      enfermeria/
        avisos/
          page.tsx           # NUEVO
      admin/
        avisos/
          page.tsx           # NUEVO
  components/
    app-shell.tsx            # MOD: prop avisosNoLeidos + badge en el ítem de nav de avisos
    avisos/
      bandeja-avisos.tsx     # NUEVO: Client Component lista + botón marcar todos
      aviso-item.tsx         # NUEVO: Client Component fila individual
docs/
  PLAN-US-033.md             # Este documento
```

**No se crean ni modifican:**
- `prisma/schema.prisma` — `AvisoInterno` ya existe.
- `src/lib/email/*` — completamente implementado por US-031.
- `src/lib/notificaciones/email-turno.ts` — se reutiliza, no se modifica.
- `package.json` / `package-lock.json` — `nodemailer` ya instalado.

---

## 7. Contratos de código

### 7.1 Tipos y consultas — agregar a `src/lib/notificaciones/avisos.ts`

```ts
import { prisma } from "@/lib/db/prisma";
import { destinatarioDeTurno } from "@/lib/notificaciones/email-turno";
import type { Rol } from "@/generated/prisma/client";

export interface AvisoInternoViewData {
  id: string;                // BigInt serializado como string (Next.js no serializa BigInt)
  turnoId: string | null;
  evento: string;
  resumen: string;
  leido: boolean;
  creadoEn: string;          // ISO 8601
  enlaceDisponible: boolean; // true si el usuario sigue teniendo acceso al turno vinculado (CA2, CA3)
}

/**
 * Carga la bandeja del usuario con verificación de acceso al enlace (CA2, CA3).
 *
 * Para PACIENTE/MEDICO: verifica acceso al turno via destinatarioDeTurno().
 * Para ADMIN/ENFERMERIA: no generan enlaces (turnoId = null en sus avisos).
 *
 * Serializa BigInt a string antes de retornar (Client Component safe).
 */
export async function obtenerBandejaAvisos({
  usuarioId,
  rol,
}: {
  usuarioId: bigint;
  rol: Rol;
}): Promise<AvisoInternoViewData[]> {
  const avisos = await prisma.avisoInterno.findMany({
    where: { usuarioId },
    orderBy: { creadoEn: "desc" },
  });

  return Promise.all(
    avisos.map(async (a) => {
      let enlaceDisponible = false;
      if (a.turnoId && (rol === "PACIENTE" || rol === "MEDICO")) {
        // CA2, CA3: verificar que el usuario sigue teniendo acceso al turno.
        // destinatarioDeTurno resuelve tutor vigente o paciente activo.
        const dest = await destinatarioDeTurno(prisma, a.turnoId);
        enlaceDisponible = dest?.usuarioId === usuarioId;
      }
      return {
        id: a.id.toString(),
        turnoId: a.turnoId?.toString() ?? null,
        evento: a.evento,
        resumen: a.resumen,
        leido: a.leido,
        creadoEn: a.creadoEn.toISOString(),
        enlaceDisponible,
      };
    }),
  );
}

/**
 * Cuenta los avisos no leídos del usuario (para el badge del AppShell).
 */
export async function contarAvisosNoLeidos(usuarioId: bigint): Promise<number> {
  return prisma.avisoInterno.count({
    where: { usuarioId, leido: false },
  });
}
```

> **Nota de rendimiento:** La verificación de enlace realiza una query por aviso con `turnoId`. Para el volumen esperado en la demo (decenas de avisos) es aceptable. Si en el futuro el volumen crece, se puede cargar los turnoIds en batch y resolver en memoria.

### 7.2 Server Actions — `src/app/actions/avisos.ts`

```ts
"use server";

import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/auth/session";
import { AUDITORIA, MSG } from "@/lib/auth/constants";
import { revalidatePath } from "next/cache";
import { INICIO_POR_ROL } from "@/lib/auth/constants";

export type ResultadoMarcarLeido =
  | { exito: true; mensaje: string }
  | { exito: false; error: string };

/**
 * Marca un aviso individual como leído.
 * Verifica que el aviso pertenece al usuario autenticado (CA2).
 */
export async function marcarAvisoLeidoAction(
  avisoId: string,
): Promise<ResultadoMarcarLeido> {
  // 1. Sesión — cualquier rol
  const sesion = await requireSession();
  // 2. Validar BigInt
  let id: bigint;
  try { id = BigInt(avisoId); } catch { return { exito: false, error: MSG.AVISOS_NO_ENCONTRADO }; }
  // 3. Verificar que el aviso existe Y pertenece al usuario (CA2)
  const aviso = await prisma.avisoInterno.findFirst({
    where: { id, usuarioId: BigInt(sesion.usuarioId) },
  });
  if (!aviso) return { exito: false, error: MSG.AVISOS_NO_ENCONTRADO };
  // 4. Idempotente: si ya está leído, retornar ok
  if (aviso.leido) return { exito: true, mensaje: MSG.AVISOS_YA_LEIDO };
  // 5. Actualizar
  await prisma.avisoInterno.update({ where: { id }, data: { leido: true } });
  // 6. Revalidar la página de avisos del rol
  revalidatePath(INICIO_POR_ROL[sesion.rol] + "/avisos");
  return { exito: true, mensaje: MSG.AVISOS_MARCADO_LEIDO };
}

/**
 * Marca todos los avisos no leídos del usuario como leídos.
 * Registra auditoría con la cantidad afectada.
 */
export async function marcarTodosLeidosAction(): Promise<ResultadoMarcarLeido> {
  const sesion = await requireSession();
  const usuarioId = BigInt(sesion.usuarioId);

  const { count } = await prisma.$transaction(async (tx) => {
    const r = await tx.avisoInterno.updateMany({
      where: { usuarioId, leido: false },
      data: { leido: true },
    });
    if (r.count > 0) {
      await tx.auditoria.create({
        data: {
          actorId: usuarioId,
          accion: AUDITORIA.MARCAR_AVISOS_LEIDOS,
          entidad: "aviso_interno",
          detalle: `${r.count} aviso(s) marcados como leídos`,
        },
      });
    }
    return r;
  });

  revalidatePath(INICIO_POR_ROL[sesion.rol] + "/avisos");
  return {
    exito: true,
    mensaje: count > 0 ? MSG.AVISOS_TODOS_LEIDOS : MSG.AVISOS_SIN_PENDIENTES,
  };
}
```

### 7.3 Route Handler — `src/app/api/avisos/[id]/leer/route.ts`

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const sesion = await getSession();
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id: rawId } = await params;
  let id: bigint;
  try { id = BigInt(rawId); } catch { return NextResponse.json({ error: "ID inválido" }, { status: 400 }); }

  // CA2: verificar que el aviso pertenece al usuario de la sesión
  const aviso = await prisma.avisoInterno.findFirst({
    where: { id, usuarioId: BigInt(sesion.usuarioId) },
  });
  if (!aviso) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.avisoInterno.update({ where: { id }, data: { leido: true } });
  return NextResponse.json({ ok: true });
}
```

### 7.4 Páginas — patrón Server Component por rol

Cada `page.tsx` sigue este patrón (adaptando el rol y el texto descriptivo):

```ts
// src/app/(app)/paciente/avisos/page.tsx  — reemplazar el stub actual
import { requireRole } from "@/lib/auth/guards";
import { obtenerBandejaAvisos } from "@/lib/notificaciones/avisos";
import { BandejaAvisos } from "@/components/avisos/bandeja-avisos";

export default async function AvisosPage() {
  const sesion = await requireRole("PACIENTE"); // cambiar por rol correspondiente
  const avisos = await obtenerBandejaAvisos({
    usuarioId: BigInt(sesion.usuarioId),
    rol: "PACIENTE",
  });

  return (
    <>
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1>Notificaciones</h1>
          <p>Revisá los avisos sobre tus reservas y las de tus pacientes a cargo.</p>
        </div>
      </div>
      <BandejaAvisos avisos={avisos} rol="PACIENTE" />
    </>
  );
}
```

### 7.5 `BandejaAvisos` — Client Component

```ts
"use client";

import { useTransition, useState } from "react";
import type { AvisoInternoViewData } from "@/lib/notificaciones/avisos";
import { marcarTodosLeidosAction } from "@/app/actions/avisos";
import { AvisoItem } from "./aviso-item";

type Props = {
  avisos: AvisoInternoViewData[];
  rol: string; // para construir el href del enlace a la cita
};

export function BandejaAvisos({ avisos: inicial, rol }: Props) {
  const [lista, setLista] = useState(inicial);
  const [isPending, startTransition] = useTransition();

  const hayNoLeidos = lista.some((a) => !a.leido);

  function onLeer(id: string) {
    setLista((prev) => prev.map((a) => (a.id === id ? { ...a, leido: true } : a)));
  }

  function onMarcarTodos() {
    startTransition(async () => {
      await marcarTodosLeidosAction();
      setLista((prev) => prev.map((a) => ({ ...a, leido: true })));
    });
  }

  if (lista.length === 0) {
    return (
      <section className="sigsam-card">
        <p>No tenés avisos por el momento.</p>
      </section>
    );
  }

  return (
    <section className="sigsam-card">
      {hayNoLeidos && (
        <div style={{ marginBottom: "16px" }}>
          <button
            className="sigsam-btn-secondary"
            onClick={onMarcarTodos}
            disabled={isPending}
          >
            {isPending ? "Marcando…" : "Marcar todos como leídos"}
          </button>
        </div>
      )}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {lista.map((a) => (
          <AvisoItem key={a.id} aviso={a} rol={rol} onLeer={onLeer} />
        ))}
      </ul>
    </section>
  );
}
```

### 7.6 `AvisoItem` — Client Component

```ts
"use client";

import { useTransition } from "react";
import Link from "next/link";
import type { AvisoInternoViewData } from "@/lib/notificaciones/avisos";
import { marcarAvisoLeidoAction } from "@/app/actions/avisos";

const fmt = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

type Props = {
  aviso: AvisoInternoViewData;
  rol: string;
  onLeer: (id: string) => void;
};

export function AvisoItem({ aviso, rol, onLeer }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleMarcar() {
    startTransition(async () => {
      await marcarAvisoLeidoAction(aviso.id);
      onLeer(aviso.id);
    });
  }

  return (
    <li style={{ borderBottom: "1px solid var(--border)", padding: "12px 0" }}>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
        <span className={`sigsam-badge ${aviso.leido ? "neutral" : "warning"}`}>
          {aviso.leido ? "Leído" : "No leído"}
        </span>
        <span style={{ fontSize: "12px", color: "var(--muted)" }}>
          {fmt.format(new Date(aviso.creadoEn))}
        </span>
      </div>

      <strong>{aviso.evento}</strong>
      <p style={{ margin: "4px 0 8px" }}>{aviso.resumen}</p>

      <div style={{ display: "flex", gap: "8px" }}>
        {/* CA2, CA3: enlace solo si el acceso al turno sigue vigente */}
        {aviso.enlaceDisponible && aviso.turnoId && (
          <Link href={`/${rol}/turnos/${aviso.turnoId}`} className="sigsam-btn-ghost">
            Ver cita
          </Link>
        )}
        {!aviso.leido && (
          <button
            className="sigsam-btn-ghost"
            onClick={handleMarcar}
            disabled={isPending}
          >
            {isPending ? "Marcando…" : "Marcar como leído"}
          </button>
        )}
      </div>
    </li>
  );
}
```

### 7.7 Modificaciones en `AppShell` (`src/components/app-shell.tsx`)

```ts
// Agregar prop:
// avisosNoLeidos?: number

// Marcar el ítem de avisos en NAV_POR_ROL con una propiedad extra:
type NavItem = { href: string; label: string; esAvisos?: true };

// En el render de cada enlace:
{it.esAvisos && (avisosNoLeidos ?? 0) > 0 && (
  <span
    className="sigsam-badge warning"
    aria-label={`${avisosNoLeidos} sin leer`}
    style={{ marginLeft: "6px" }}
  >
    {(avisosNoLeidos ?? 0) > 99 ? "99+" : avisosNoLeidos}
  </span>
)}
```

Agregar `esAvisos: true` al ítem de avisos de cada rol en `NAV_POR_ROL`.

### 7.8 Modificación del layout `(app)` — `src/app/(app)/layout.tsx`

```ts
import { contarAvisosNoLeidos } from "@/lib/notificaciones/avisos";

export default async function AppGroupLayout({ children }: { children: ReactNode }) {
  const sesion = await requireSession();
  if (sesion.claveTemporal) redirect("/cambiar-clave");

  // El conteo se recalcula en SSR en cada navegación (badge siempre fresco)
  const avisosNoLeidos = await contarAvisosNoLeidos(BigInt(sesion.usuarioId));

  return (
    <AppShell sesion={sesion} avisosNoLeidos={avisosNoLeidos}>
      {children}
    </AppShell>
  );
}
```

---

## 8. Constantes a agregar en `src/lib/auth/constants.ts`

```ts
// En el objeto MSG:
AVISOS_MARCADO_LEIDO: "Aviso marcado como leído.",
AVISOS_YA_LEIDO: "Este aviso ya estaba marcado como leído.",
AVISOS_TODOS_LEIDOS: "Todos los avisos fueron marcados como leídos.",
AVISOS_SIN_PENDIENTES: "No hay avisos sin leer.",
AVISOS_NO_ENCONTRADO: "El aviso no existe o no tenés acceso.",
AVISOS_ERROR_ACTUALIZAR: "No se pudo actualizar el aviso. Intentá nuevamente.",
AVISOS_SIN_PERMISO: "Tu rol no tiene permiso para ver esta bandeja.",

// En el objeto AUDITORIA:
MARCAR_AVISOS_LEIDOS: "Marcado masivo de avisos como leídos",
```

---

## 9. Navegación — `AppShell` por rol

| Rol | Estado actual | Acción |
| --- | --- | --- |
| `PACIENTE` | Ya tiene `{ href: "/paciente/avisos", label: "Avisos" }` | Agregar `esAvisos: true` |
| `MEDICO` | Sin ítem de avisos | **Agregar** `{ href: "/medico/avisos", label: "Avisos", esAvisos: true }` |
| `ENFERMERIA` | Sin ítem de avisos | **Agregar** `{ href: "/enfermeria/avisos", label: "Avisos", esAvisos: true }` |
| `ADMIN` | Sin ítem de avisos | **Agregar** `{ href: "/admin/avisos", label: "Avisos", esAvisos: true }` |

---

## 10. Cómo testear el flujo

### 10.1 Verificación automatizada previa

```bash
npm run format
npm run lint
npm run format:check
npm run build
```

### 10.2 Checklist de pruebas manuales (E2E)

Credenciales: `paciente@sigsam.local` / `Paciente@1234`, `medico@sigsam.local` / `Medico@1234`, `admin@sigsam.local` / `Admin@1234`.

#### Escenario 1: Avisos generados por US-031 aparecen en la bandeja (CA1)
1. Confirmar un turno como paciente (US-031 dispara `crearAvisoConfirmacion` en la transacción y `notificarPorEmail` fire-and-forget).
2. Ir a `/paciente/avisos`.
3. **Esperado:** aparece el aviso "Turno confirmado" con estado "No leído" y fecha correcta. El email puede o no haber llegado, pero el aviso siempre está.

#### Escenario 2: Cancelación genera aviso (CA1)
1. Cancelar un turno como paciente.
2. Ir a `/paciente/avisos`.
3. **Esperado:** aviso "Cancelación de turno", "No leído".

#### Escenario 3: Marcar aviso individual como leído (CA1, CA2)
1. Clic en "Marcar como leído" en un aviso.
2. **Esperado:** badge cambia a "Leído" optimistamente; badge del nav disminuye en 1 tras revalidación.

#### Escenario 4: Marcar todos como leídos + auditoría (CA1)
1. Con varios avisos sin leer, clic en "Marcar todos como leídos".
2. **Esperado:** todos pasan a "Leído"; badge del nav desaparece; existe fila en `auditoria` con acción "Marcado masivo de avisos como leídos".

#### Escenario 5: Bandeja vacía (CA1)
1. Usuario nuevo sin avisos.
2. **Esperado:** mensaje "No tenés avisos por el momento." sin errores.

#### Escenario 6: Tutor retirado — aviso sin enlace (CA3)
1. Crear aviso vinculado a un turno de un menor con tutor.
2. Desvincular al tutor (campo `tutorId = null` en el paciente menor).
3. Como el ex-tutor, ir a `/paciente/avisos`.
4. **Esperado:** aviso muestra resumen y evento, pero NO el enlace "Ver cita". `destinatarioDeTurno` retorna `null` al no haber tutor vigente.

#### Escenario 7: Aislación entre usuarios (CA2)
1. Con el ID de un aviso de otro usuario, intentar `PATCH /api/avisos/[id_ajeno]/leer`.
2. **Esperado:** respuesta 404. El aviso ajeno no es visible ni accesible.

#### Escenario 8: CA5 — email fallido no elimina aviso
1. Configurar un SMTP inválido (o `SMTP_HOST` vacío).
2. Confirmar un turno.
3. Verificar en la tabla `aviso_interno` de la base de datos.
4. **Esperado:** el registro existe aunque `IntentoEmail` tenga resultado FALLIDO. La garantía ya está en la arquitectura de US-031.

#### Escenario 9: Badge en AppShell (CA1)
1. Con 3 avisos sin leer, navegar por cualquier página del rol.
2. **Esperado:** badge "3" visible junto al enlace "Avisos" en el nav.
3. Marcar todos como leídos y navegar.
4. **Esperado:** badge desaparece (el layout recalcula en SSR).

#### Escenario 10: Bandejas independientes por rol (CA1, CA4)
1. Login como médico → `/medico/avisos`: solo sus avisos.
2. Login como admin → `/admin/avisos`: solo sus avisos.
3. Login como enfermería → `/enfermeria/avisos`: sus alertas de stock (cuando US-027 esté activo).
4. **Esperado:** cada rol ve únicamente sus propios registros. El paciente no ve alertas de stock.

---

## 11. Decisión arquitectónica propuesta (D-23)

Proponer en `docs/DECISIONES.md`:

### D-23 — Bandeja de avisos internos unificada por usuario (US-SIG-033)

- **Estado:** Propuesta
- **Decisión:** La bandeja de avisos es una vista Server Component que lee `AvisoInterno` filtrada por `usuarioId`. El marcado como leído usa Server Actions con el mismo filtro. Los avisos son inmutables (solo `leido` cambia). El `AppShell` muestra un badge con el conteo calculado en SSR. No hay paginación en v1. La verificación del enlace a la cita reutiliza `destinatarioDeTurno()` de `email-turno.ts` (ya implementado en US-031) para garantizar CA2 y CA3. La garantía CA5 (email fallido no elimina aviso) proviene de la arquitectura de US-031 y no requiere código adicional.
- **Motivo:** Cumplimiento de CA1 a CA5. La reutilización de `destinatarioDeTurno()` evita duplicar la lógica de resolución tutor/paciente activo.

---

## 12. Notas de implementación

- **BigInt:** `obtenerBandejaAvisos` serializa todos los `BigInt` a `string` antes de retornar. Next.js no serializa `BigInt` automáticamente al pasar props a Client Components.
- **Formato de fecha:** Usar `Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' })` — mismo patrón que `templates.ts` de US-031.
- **`useTransition`:** obligatorio en los botones de marcar leído para deshabilitar durante la Server Action y evitar doble submit.
- **Badge > 99:** mostrar `"99+"` en lugar del número exacto.
- **Avisos sin `turnoId`:** los de Enfermería (alerta stock) tienen `turnoId = null`. `enlaceDisponible` será `false` siempre. No mostrar "Ver cita".
- **`requireRole` vs `requireSession`:** las páginas de bandeja usan `requireRole` para garantizar el rol correcto y redirigir a `/sin-permiso` si no coincide. El Route Handler `/api/avisos/[id]/leer` solo necesita `getSession()` porque cualquier rol autenticado puede marcar sus propios avisos.
- **Rendimiento del layout:** `contarAvisosNoLeidos` es una query `COUNT` simple con índice `[usuarioId, creadoEn]` — latencia despreciable.
- **Stub actual de `/paciente/avisos`:** reemplazarlo completamente, no extenderlo.
- **Variables de entorno SMTP** (ya definidas por US-031): `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `APP_URL`, `EMAIL_OVERRIDE_TO`, `EMAIL_RETRY_DELAY_MS`. No agregar nuevas para esta US.
