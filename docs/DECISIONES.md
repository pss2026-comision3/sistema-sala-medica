# Registro de decisiones — SIGSAM

> **Qué es este archivo.** Registro de las decisiones ya tomadas por el equipo
> (stack, arquitectura, convenciones). Es de **lectura obligatoria** antes de
> tocar el código.
>
> **Regla de oro.** Si una decisión de acá te parece equivocada, **no la reviertas
> por tu cuenta en el código**. Abrí un PR que modifique *este archivo* (cambiando
> el estado a `Reemplazada` y agregando la nueva decisión), y discutilo con el
> equipo. El código debe reflejar lo que dice este documento.
>
> Complementa a `docs/CONTEXTO-PROYECTO.md` (contexto general y reparto de USs).

Estados: `Aceptada` · `Reemplazada` · `Propuesta`.

---

## D-01 — Stack base: Next.js + TypeScript

- **Estado:** Aceptada (2026-10-04)
- **Decisión:** Frontend y backend en **Next.js 16 (App Router)** con **TypeScript**.
- **Consecuencias:** toda la app vive en `src/app`; la API se implementa con
  Route Handlers (`src/app/api/.../route.ts`) y Server Actions donde aplique.
- **No revertir a:** Pages Router, JavaScript pelado o un backend separado.

## D-02 — Base de datos: PostgreSQL en Supabase (solo como Postgres)

- **Estado:** Aceptada (2026-10-04)
- **Decisión:** usar **Supabase únicamente como PostgreSQL** gestionado.
- **No usar:** Supabase Auth, Supabase Storage ni Realtime para la lógica de negocio.
- **Motivo:** se necesita control total del modelo de datos y de la autenticación.

## D-03 — Acceso a datos: Prisma 7 + migraciones

- **Estado:** Aceptada (2026-10-04)
- **Decisión:** **Prisma ORM 7** (`prisma@7.10.0` + `@prisma/client@7.10.0`)
  como única vía a la base. Los cambios de esquema van por migraciones
  (`prisma migrate`), nunca editando tablas a mano.
- **Consecuencias / particularidades de la v7** (importantes, no son las de v6):
  - **Config en `prisma7.config.ts`** (raíz), no en `schema.prisma`. El bloque
    `datasource` del schema lleva **solo `provider`**.
  - El **CLI usa la conexión directa** (`DIRECT_URL`); la **app en runtime usa
    `DATABASE_URL`** (pooler) a través del driver adapter. Prisma 7 **no** tiene
    `directUrl` en el config.
  - SQL requiere **driver adapter**: `@prisma/adapter-pg` (+ `pg`). El singleton
    está en `src/lib/db/prisma.ts` y hace `new PrismaPg(connectionString)`.
    **Ojo:** pasarle un objeto (`{ connectionString }`) hace que la v7 lo
    interprete como opciones de `pg.Pool` y falle con `ECONNREFUSED`; hay que
    pasarle el **string** (o un `pg.Pool`).
  - Las URLs de Supabase deben llevar **`&uselibpqcompat=true`** además de
    `sslmode=require`: el driver `pg` v8.23 interpreta `require` como
    `verify-full` y rechaza el certificado de Supabase. Ver `docs/SUPABASE.md`.
  - Generator es **`prisma-client`** y el cliente se genera en
    **`src/generated/prisma`** (gitignored). Se regenera con `npm run db:generate`
    (y automáticamente vía `postinstall`). Import: `@/generated/prisma/client`.
  - Requiere `dotenv` (el `.env` **no** se autoload en v7).
  - `prisma/schema.prisma` es la **fuente de verdad del modelo**. Refleja el ER
    de `docs/baseDeDatos.md` con las desviaciones documentadas en D-15 y D-16.
    Cualquier cambio de modelo va por migración, nunca por SQL manual.
- **Mapeo de tipos** (Postgres ↔ Prisma):
  `bigserial/bigint→BigInt`, `smallint→Int @db.SmallInt`, `varchar→String`
  (con `@db.VarChar(N)` cuando tiene tope: nombres, códigos, emails; sin tope →
  `text`), `text→String @db.Text`, `decimal→Decimal @db.Decimal(10, 2)`,
  `timestamptz→DateTime @db.Timestamptz(6)`, `date→DateTime @db.Date`,
  `time→DateTime @db.Time(6)`. Los campos `time` Prisma los expone como
  `DateTime` con fecha base `1970-01-01` UTC: usá sólo la parte de hora.
- **Scripts:** `db:generate`, `db:migrate`, `db:studio`.

## D-04 — Auth propia en Next.js (SIN Clerk ni Supabase Auth)

- **Estado:** Aceptada (2026-10-04)
- **Decisión:** implementar la autenticación nosotros mismos.
- **Motivo:** el sistema exige comportamientos que los SaaS de auth no modelan
  sin fricción: **sin autorregistro**, **clave temporal con cambio forzado**,
  **expiración por 15 min de inactividad**, **4 roles fijos**, y revocación
  inmediata de sesión al desactivar una cuenta.
- **Descartado explícitamente:** Clerk y Supabase Auth.
- **No revertir sin:** justificar cómo se cubren los CA de US-001, US-005 y US-006.

## D-05 — Sesiones persistidas en la base de datos

- **Estado:** Aceptada (2026-10-04)
- **Decisión:** las sesiones se guardan en una tabla `sesion` (token hasheado +
  `ultima_actividad`), no en un JWT autocontenido.
- **Motivo:** permite expiración por inactividad (15 min) y **revocación inmediata**
  (cerrar sesión, desactivar cuenta → CA4 de US-001 y CA5 de US-005).
- **Consecuencias:** cada request autenticado valida y actualiza la actividad de la fila.
- **Nota de modelo:** `sesion` es la única tabla fuera del ER
  (`docs/baseDeDatos.md`). Vive en `prisma/schema.prisma` y se aplica en la
  migración inicial para no quedar desfasada del resto del sistema.

## D-06 — Hash de contraseñas con bcryptjs

- **Estado:** Aceptada (2026-10-04)
- **Decisión:** hashear con **bcryptjs** (implementación en JS puro).
- **Motivo:** evita compilación nativa problemática en Windows (`bcrypt`/`argon2`).
- **Regla absoluta:** nunca guardar ni loguear contraseñas en texto legible.

## D-07 — Roles fijos como enum y sin autorregistro

- **Estado:** Aceptada (2026-10-04)
- **Decisión:** `rol` es un enum con exactamente 4 valores:
  `ADMIN`, `MEDICO`, `ENFERMERIA`, `PACIENTE`. Cada cuenta tiene un único rol.
- **Reglas asociadas:** sin autorregistro; **el Admin crea todas las cuentas**;
  sin roles combinados ni editor de permisos; siempre debe existir al menos una
  cuenta `ADMIN` activa.

## D-08 — Email único normalizado

- **Estado:** Aceptada (2026-10-04)
- **Decisión:** `usuario.email` es único y se **normaliza a minúsculas y sin
  espacios externos** antes de guardar/comparar.
- **Consecuencias:** comparaciones de login deben aplicar la misma normalización.

## D-09 — Next 16 usa `proxy.ts` (ex-middleware)

- **Estado:** Aceptada (2026-10-04)
- **Decisión:** el chequeo de sesión/rol a nivel de request se hace en `src/proxy.ts`.
- **Motivo:** en Next.js 16 *Middleware* pasó a llamarse **Proxy**. `proxy.ts` es
  solo una capa **optimista** de redirección; la autorización real se verifica
  igualmente en cada Route Handler / Server Action.

## D-10 — UI con Tailwind v4 (sin shadcn por ahora)

- **Estado:** Aceptada (2026-10-04)
- **Decisión:** estilar con **Tailwind CSS v4**. **No** incorporar shadcn/ui ni
  otra librería de componentes por ahora.
- **Consecuencias:** UI **responsive** (desktop y móvil) hecha a mano; no hay app nativa.

## D-11 — Calidad: ESLint + Prettier como compuerta

- **Estado:** Aceptada (2026-10-04)
- **Decisión:** antes de cada PR deben pasar `npm run lint`, `npm run format:check`
  y `npm run build`.
- **Consecuencias:** Prettier ordena clases de Tailwind automáticamente; no se
  discute formato en los PR.

## D-12 — Puesta en marcha: seed del Admin inicial

- **Estado:** Aceptada (2026-10-04)
- **Decisión:** el primer Administrador se **siembra** con `prisma/seed.ts`, con
  `clave_temporal = true` (CA5 de US-004 / CA3 de US-001).
- **Consecuencias:** no hay pantalla de autorregistro; los datos de prueba se cargan por seed.

## D-13 — Convención de ramas y flujo de Git

- **Estado:** Aceptada (2026-10-04)
- **Decisión:** una rama por US con el formato `feature/us-XXX-descripcion`; PR a
  `main` con al menos una revisión. `main` protegida.
- **Reglas:** **no commitear `.env`** (solo `.env.example`); commits descriptivos.

## D-14 — Uso de IA documentado

- **Estado:** Aceptada (2026-10-04)
- **Decisión:** el uso de IA está permitido pero debe **documentarse** (prompt,
  modelo y versión) en los informes. La estimación del Sprint 1 se hizo **sin IA**.

## D-15 — Enums de Postgres para dominios cerrados

- **Estado:** Aceptada (2026-10-04)
- **Decisión:** los campos con un conjunto **cerrado y conocido** de valores se
  modelan como `enum` de Postgres, no como `varchar`. Concretamente:
  - `rol` (`ADMIN/MEDICO/ENFERMERIA/PACIENTE`).
  - `turno.estado` (`RESERVADO/CONFIRMADO/CANCELADO`).
  - `disponibilidad.estado` (`PUBLICADA/SUSPENDIDA`).
  - `turno.resultado` (`SIN_REGISTRAR/ATENDIDO/AUSENTE`).
  - `turno.tipo` (`CONSULTA/VACUNACION`).
  - `turno.modalidad` (`PARTICULAR/CON_COBERTURA`).
  - `movimiento_stock.tipo` (`COMPRA/APLICACION/AJUSTE`).
  - `pago_manual.estado` (`APROBADO/RECHAZADO/CANCELADO/ANULADO`).
  - `evento_email.tipo_evento` (`CONFIRMACION/CANCELACION/SUSPENSION/RECORDATORIO/ALERTA_STOCK`).
  - `intento_email.resultado` (`EXITO/FALLIDO`).
- **Quedan `varchar`/`text`** (texto libre o dominios abiertos):
  `origen_cancelacion`, `medio` de pago, `accion`/`entidad` de auditoría,
  todos los `motivo_*` y los snapshots de comprobantes (preservan el valor
  aunque el enum cambie).
- **Motivo:** Postgres rechaza valores fuera del enum, así que es imposible
  guardar estados inválidos. El ER original marcaba `varchar`, pero
  `schema.prisma` (fuente de verdad por D-03) lleva el modelo más estricto.
  `docs/baseDeDatos.md` no se modifica porque es el entregable de análisis.

## D-16 — SQL a mano dentro de la migración inicial (índices case-insensitive + CHECK)

- **Estado:** Aceptada (2026-10-04)
- **Decisión:** la migración inicial agrega, **a mano**, dentro del
  `migration.sql` generado por Prisma:
  - **Índices únicos case-insensitive** sobre `lower(usuario.email)`,
    `lower(obra_social.nombre)` y `lower(vacuna.nombre)` (cumplen US-002 CA2,
    US-041 CA2 y US-021 CA1 sin obligar a normalizar en cada comparación).
  - **CHECK de coherencia de cobertura** en `paciente`:
    `(obra_social_id IS NULL AND plan IS NULL AND numero_afiliado IS NULL)`
    o los tres `NOT NULL` (US-028 CA1).
  - **CHECK de rangos** no negociables:
    `medico.duracion_turno_min > 0`, `medico.arancel_actual >= 0`,
    `vacuna.umbral_minimo >= 0`, `vacuna.arancel_actual >= 0`,
    `turno.duracion_min > 0`, `turno.arancel >= 0`,
    `movimiento_stock.cantidad <> 0`, `pago_manual.importe >= 0`.
  - **CHECK de consistencia de estados**:
    `disponibilidad.hora_hasta > hora_desde`;
    si `estado='SUSPENDIDA'` ⇒ `motivo_suspension`/`suspendida_en`/`suspendida_por`
    `NOT NULL`;
    si `turno.estado='RESERVADO'` ⇒ `retenido_hasta` `NOT NULL`;
    si `turno.estado='CANCELADO'` ⇒ `cancelado_en`/`cancelado_por`/`motivo_cancelacion`
    `NOT NULL`;
    si `turno.resultado='ATENDIDO'` ⇒ `atendido_en` `NOT NULL`;
    si `movimiento_stock.tipo='AJUSTE'` ⇒ `motivo` `NOT NULL`;
    si `pago_manual.estado='ANULADO'` ⇒ `motivo_anulacion` `NOT NULL`.
  - **CHECK de contenido obligatorio no vacío**:
    `length(trim(consulta.diagnostico)) > 0`,
    `length(trim(correccion.texto)) > 0`,
    `length(trim(correccion.motivo)) > 0`.
- **Motivo:** Prisma no puede expresar índices funcionales ni CHECK en el
  schema. Se agregan en el SQL de la migración inicial (Paso 5) para que
  vivan en la misma migración que las tablas y no haya que crear una segunda
  después.

---

## Cómo agregar una decisión

1. Copiá el formato de una decisión existente.
2. Si reemplaza a otra, cambiá el estado de la anterior a `Reemplazada` y dejá
   la referencia cruzada.
3. Si es una idea aún no cerrada, marcala como `Propuesta` y llevala a discusión.
4. Actualizá el código para reflejar el resultado, en el mismo PR.
