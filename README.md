# SIGSAM — Sistema Integral de Gestión para Sala Médica

Aplicación web para gestionar turnos, agenda de profesionales, pacientes,
vacunación, cobros, obras sociales y auditoría de una sala médica.

- **Materia:** Proyectos de Sistemas de Software (PSS) 2026 — Comisión 3.
- **Enunciado:** Nº 2 — Sala médica.
- **Stack:** [Next.js 16](https://nextjs.org) (App Router) · TypeScript · Tailwind CSS v4 · Prisma 7 · PostgreSQL (Supabase).

> **Antes de tocar el código, leé [`docs/DECISIONES.md`](docs/DECISIONES.md).**
> Ahí están las decisiones ya tomadas por el equipo (stack, auth, modelo de
> datos). No las reviertas por tu cuenta.

## Requisitos

- **Node.js ≥ 20.19** (Prisma 7 lo exige) y npm.
- Una base **PostgreSQL** (usamos Supabase solo como Postgres).
- Cuenta de Supabase (plan Free alcanza para el Sprint 1).

## Puesta en marcha

```powershell
# 1. Instalar dependencias (el postinstall genera el cliente Prisma)
npm install

# 2. Configurar el entorno
Copy-Item .env.example .env
#    Completá DATABASE_URL, DIRECT_URL y SHADOW_DATABASE_URL siguiendo
#    docs/SUPABASE.md (incluye crear la base "shadow" una vez).

# 3. Aplicar la migración inicial (crea tablas, índices y CHECK)
npm run db:migrate

# 4. Sembrar el Admin inicial (clave temporal)
npm run db:seed

# 5. Levantar el servidor de desarrollo
npm run dev
```

La app queda en <http://localhost:3000>.

### Credenciales del seed

El seed (`prisma/seed.ts`) crea el primer Administrador. Por defecto:

| Campo          | Valor                                        |
| -------------- | -------------------------------------------- |
| Email          | `admin@sigsam.local`                         |
| Contraseña     | `Admin@1234`                                 |
| Rol            | `ADMIN`                                      |
| Clave temporal | `sí` (obliga a cambiarla en el primer login) |

Se pueden sobreescribir con las variables `ADMIN_EMAIL`, `ADMIN_PASSWORD` y
`ADMIN_NOMBRE` del `.env`.

## Comandos

| Comando                | Qué hace                                             |
| ---------------------- | ---------------------------------------------------- |
| `npm run dev`          | Servidor de desarrollo.                              |
| `npm run build`        | Build de producción.                                 |
| `npm run lint`         | ESLint.                                              |
| `npm run format`       | Aplica Prettier.                                     |
| `npm run format:check` | Verifica el formato sin escribir.                    |
| `npm run db:generate`  | Regenera el cliente Prisma (`src/generated/prisma`). |
| `npm run db:migrate`   | Crea y aplica migraciones (`prisma migrate dev`).    |
| `npm run db:seed`      | Siembra el Admin inicial.                            |
| `npm run db:studio`    | Abre Prisma Studio.                                  |

Antes de cada PR deben pasar `npm run lint`, `npm run format:check` y
`npm run build` (ver D-11).

## Estructura

```
prisma/
  schema.prisma            # Fuente de verdad del modelo (21 tablas, 10 enums)
  seed.ts                  # Admin inicial con clave temporal (D-12)
  migrations/              # Migraciones + SQL a mano (índices/CHECK, D-16)
src/
  app/                     # Rutas y UI (App Router)
    api/auth/              # Route Handlers de autenticación (US-001)
  lib/
    db/prisma.ts           # Singleton de PrismaClient (driver adapter pg)
    auth/                  # Lógica de sesión/roles (US-001)
  generated/prisma/        # Cliente Prisma generado (gitignored)
docs/
  DECISIONES.md            # Registro de decisiones del equipo
  CONTEXTO-PROYECTO.md     # Contexto general y reparto de USs
  SUPABASE.md              # Guía para configurar la base
  baseDeDatos.md           # Modelo ER de referencia
```

## Documentación

- [`docs/DECISIONES.md`](docs/DECISIONES.md) — decisiones de arquitectura.
- [`docs/CONTEXTO-PROYECTO.md`](docs/CONTEXTO-PROYECTO.md) — contexto y alcance.
- [`docs/SUPABASE.md`](docs/SUPABASE.md) — configurar la base de datos.
- [`docs/baseDeDatos.md`](docs/baseDeDatos.md) — modelo de datos de referencia.
