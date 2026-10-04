# Guía: configurar Supabase para SIGSAM

Supabase se usa **solo como Postgres gestionado** (ver D-02 en
`docs/DECISIONES.md`). **No** usamos Supabase Auth, Supabase Storage ni
Supabase Realtime. Toda la lógica de autenticación vive en la propia app.

## 1. Crear el proyecto

1. Ir a <https://supabase.com/dashboard> → **New Project**.
2. **Name**: `sigsam` (o lo que prefieras).
3. **Database Password**: una contraseña fuerte. **Anotala en un gestor de
   contraseñas** porque la vas a necesitar para armar las URLs.
4. **Region**: la más cercana al equipo. Para Bahía Blanca / Buenos Aires
   va bien `aws-0-sa-east-1`; para la cátedra, `aws-0-us-east-1` también
   sirve.
6. **Plan**: Free alcanza para Sprint 1.
7. Aceptar y esperar ~2 minutos al provisioning.

## 2. Copiar las URLs de conexión

**Project Settings → Database**. En la sección **Connection string** vas a
ver varias URLs (los nombres cambian según la versión del dashboard; lo
importante es el puerto y el host):

- **Transaction pooler** (puerto **6543**): conexión agrupada. La usa la app
  Next.js en **runtime** a través del driver adapter.
- **Session pooler** (puerto **5432**): conexión para la **CLI** de Prisma
  (migraciones, seed). También sirve la "Direct connection" si tu proyecto
  la expone (host `db.<ref>.supabase.co`); en proyectos nuevos esa suele ser
  solo IPv6 y el pooler es lo más simple.

Reemplazá los placeholders en tu `.env` local:

```env
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require&uselibpqcompat=true"
DIRECT_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require&uselibpqcompat=true"
SHADOW_DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres_shadow?sslmode=require&uselibpqcompat=true"
```

Donde:

- `<ref>` es el **Project Reference** que aparece en la URL del dashboard
  (`https://supabase.com/dashboard/project/<ref>`).
- `<password>` es la Database Password del paso 1.
- `<region>` es la región que elegiste (ej. `sa-east-1`).
- `uselibpqcompat=true` es **obligatorio** (ver recuadro abajo).

> **Caracteres especiales en la contraseña.** Si la Database Password tiene
> `@`, `#`, `:`, `/`, `?` u otros, tenés que codificarlos en URL
> (`@` → `%40`, `#` → `%23`, etc.). Ejemplo: `Comision3@123` → `Comision3%40123`.

> **Ojo con `sslmode=require` (importante).** El driver `pg` (v8.23) interpreta
> `sslmode=require` como `verify-full` y **rechaza el certificado de Supabase**
> (error de TLS). Agregá siempre **`&uselibpqcompat=true`** para volver al
> comportamiento de libpq (cifra sin verificar el CA). Este parámetro va tanto
> en las conexiones del CLI como en la de runtime.

> **Modo Session vs Transaction del pooler.** Usá **Transaction** (6543) para
> la app: las conexiones se comparten entre requests y evitamos agotar el
> pool. Para la CLI usá **Session** (5432), que mantiene la sesión fija y
> soporta el DDL y los locks que necesitan las migraciones.

## 3. Crear la base "shadow"

`prisma migrate dev` usa una base auxiliar ("shadow database") para detectar
drift entre migraciones. El usuario `postgres` por defecto en Supabase **no
tiene permiso para crear bases** automáticamente, así que hay que crearla a
mano **una vez por proyecto**.

1. Ir a **SQL Editor** (ícono de base de datos en el panel izquierdo).
2. **New query** → pegar:
   ```sql
   CREATE DATABASE postgres_shadow;
   ```
3. **Run**.

> También se puede crear por código con el driver `pg` ejecutando el mismo
> `CREATE DATABASE postgres_shadow;` contra `DIRECT_URL` (es lo que hicimos
> en el bootstrap del proyecto). Lo importante es que exista **una vez**;
> Prisma no la vuelve a crear.

> Si en tu proyecto Supabase la base `postgres` ya tiene muchas cosas
> aplicadas, podés usar otro nombre (ej. `postgres_shadow_2026`) y
> actualizar `SHADOW_DATABASE_URL` en consecuencia.

## 4. Probar la conexión

Con el `.env` completo:

```powershell
npm install            # regenera el cliente Prisma (postinstall)
npm run db:generate    # explícito, genera cliente desde el schema
npx prisma validate    # verifica el schema
npx prisma db pull     # opcional: introspecciona la base y compara con el schema
```

Si `prisma validate` pasa y `prisma db pull` (cuando lo corras después de
aplicar la migración) devuelve las mismas tablas que el schema, todo está
bien cableado.

## 5. Aplicar la migración inicial y sembrar el Admin

```powershell
npm run db:migrate     # aplica la migración init (tablas + índices case-insensitive + CHECK de D-16)
npm run db:seed        # siembra el Admin inicial con clave temporal (D-12)
npm run db:studio      # opcional: abre Prisma Studio para inspeccionar los datos
```

El Admin por defecto es `admin@sigsam.local` / `Admin@1234` (ver README).

## 6. Troubleshooting

### `Error: P1001: Can't reach database server`

- Revisá que la URL no tenga typos.
- Confirmá el host y puerto: runtime = pooler `aws-0-<region>.pooler.supabase.com:6543`; CLI = session pooler `...:5432`.
- Supabase free tier pausa proyectos inactivos después de 7 días. En
  Settings → General podés reactivarlo.

### `Error: self-signed certificate` / `unable to verify the first certificate`

El driver `pg` (v8.23) trata `sslmode=require` como `verify-full` y no acepta
el certificado de Supabase. Agregá **`&uselibpqcompat=true`** a las URLs del
`.env` (ver paso 2).

### `ECONNREFUSED` al usar el singleton de la app

`@prisma/adapter-pg` v7 espera `new PrismaPg(connectionString)` (o un
`pg.Pool`), **no** `new PrismaPg({ connectionString })`: con el objeto, la v7
lo interpreta como opciones de `Pool` y termina intentando conectar al host
por defecto (localhost) → `ECONNREFUSED`. Está resuelto en
`src/lib/db/prisma.ts`.

### `Error: prepared statement already exists`

El pooler de Supabase (Transaction mode) no soporta prepared statements
en algunos escenarios. Si pasa:

- Confirmá que la app usa el driver adapter (`src/lib/db/prisma.ts`
  con `PrismaPg`) y `DATABASE_URL` apunta al pooler de Supabase (puerto
  6543). El adapter + driver nativo `pg` evita el prepared statement
  caching que da problemas con PgBouncer.
- La URL de runtime ya incluye `?pgbouncer=true`, que le indica a Prisma
  que no use prepared statements con nombre.

### `Error: permission denied to create database`

Prisma está intentando crear la shadow DB. Solución: definí
`SHADOW_DATABASE_URL` en `.env` y creá `postgres_shadow` como muestra el
paso 3.

### `Error: password authentication failed for user "postgres"`

La `<password>` en la URL no coincide con la Database Password. Probá
resetearla en **Project Settings → Database → Database password → Reset
database password** y reescribí `.env`.

### `Error: no node basic type specified` (no es de Supabase, es de Prisma 7)

Asegurate de tener `datasource db { provider = "postgresql" }` en
`prisma/schema.prisma` y `import "dotenv/config"` arriba de
`prisma7.config.ts`. Sin esto, Prisma 7 no sabe qué motor usar.

## 7. Lo que NO vamos a usar de Supabase

Por D-02 y D-04:

- **Supabase Auth** — la autenticación la hacemos nosotros para soportar
  clave temporal, 4 roles fijos y revocación inmediata.
- **Supabase Storage** — los adjuntos de consulta viven en el filesystem
  del servidor (carpeta local con path privado en `adjunto.ruta_privada`).
- **Supabase Realtime** — no usamos suscripciones en tiempo real.

Si alguna vez ves un "Use Supabase Auth for free!" en un tutorial,
**ignoralo**. No aplica a SIGSAM.