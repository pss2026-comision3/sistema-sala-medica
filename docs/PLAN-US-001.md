# Plan de implementación — US-SIG-001 Acceder al sistema y cerrar sesión

Este archivo es la especificación para implementar la historia. No agrega alcance. Si algo no está escrito acá, no lo inventes.

## 0. Qué hacer y qué no hacer

Implementar solo US-SIG-001. Al terminar, el usuario puede:

1. Entrar con email y contraseña.
2. Ver un inicio distinto según su rol, y no abrir por URL el inicio de otro rol.
3. Si tiene clave temporal, quedar atrapado en cambiar la contraseña hasta hacerlo.
4. Cerrar sesión. Una sesión inactiva 15 minutos, o de una cuenta desactivada, deja de servir.
5. Usar esas pantallas en escritorio y en un ancho de teléfono.

No implementar: recuperación de clave (US-006), desactivar cuentas (US-005), turnos, agenda, pacientes, parámetros, emails, reportes, rate limit, 2FA, ni Clerk/Supabase Auth.

No hacer:

- No crear `middleware.ts`. En Next 16 el archivo es `src/proxy.ts`.
- No consultar Prisma dentro de `proxy.ts`.
- No usar JWT. La sesión es una fila en `sesion`.
- No instalar dependencias (ni Zod, ni shadcn, ni `@types/bcryptjs`).
- No agregar comentarios en el código.
- No commitear. No tocar `.env`. No editar `docs/baseDeDatos.md` ni `docs/CONTEXTO-PROYECTO.md`.
- No loguear contraseñas, tokens de sesión ni hashes en `console.log`.
- No pasar `BigInt` a un Client Component. El `id` que cruza al cliente va como `string`.

Leé `docs/DECISIONES.md` antes de codear. Decisiones que este plan no puede revertir: D-04 auth propia, D-05 sesiones en tabla `sesion`, D-06 bcryptjs, D-07 cuatro roles, D-08 email normalizado, D-09 `proxy.ts` solo optimista, D-10 Tailwind v4 sin librería de componentes.

## 1. Criterios de aceptación

Texto de la historia: entrar con credenciales y cerrar sesión para usar solo lo autorizado.

- **CA1.** Se piden email y contraseña de una cuenta activa. Si las credenciales son inválidas, el mensaje no revela si el email existe.
- **CA2.** El ingreso muestra las funciones de ese rol. La misma restricción vale si se pega la URL de otro rol.
- **CA3.** Con clave temporal solo se puede definir una nueva contraseña. El resto del sistema queda bloqueado hasta hacerlo. La nueva tiene al menos 8 caracteres, se repite, y es distinta de la temporal (la repetición la pide US-006 CA3 para esta misma pantalla; incluirla).
- **CA4.** Cerrar sesión, desactivar la cuenta o 15 minutos sin actividad invalidan la sesión. Si la sesión ya no vale, no se ejecuta la operación que estaba en curso.
- **CA5.** Login, cambio de clave, shell y cierre de sesión se usan en navegador de computadora y de teléfono. Sin app nativa.

## 2. Decisiones cerradas (no reabrirlas)

| Tema | Decisión |
| --- | --- |
| Entrada de los formularios | Server Actions en `src/app/actions/auth.ts`. No crear Route Handlers. La carpeta `src/app/api/auth/` puede quedar vacía. |
| Cookie | Nombre `sigsam_sesion`. Valor opaco de 32 bytes en base64url. En la base se guarda solo el SHA-256 hex. |
| Vencimiento | La inactividad de 15 minutos se mide con `sesion.ultima_actividad`. La cookie no vence a los 15 minutos: `maxAge` de 12 horas es solo un tope duro. |
| Proxy | Solo mira si la cookie existe. No sabe el rol ni si la sesión sigue viva. |
| Autorización real | `getSession()` / `requireRole()` en layouts y al inicio de cada Server Action, contra la base. |
| Cuenta inactiva | Si la contraseña no coincide, mensaje genérico. Si coincide y `activo = false`, mensaje de cuenta desactivada. |
| Después de cambiar la clave temporal | `clave_temporal = false`, se mantiene la sesión actual y se redirige al inicio del rol. No se pide login de nuevo. |
| Otras sesiones del mismo usuario | No se cierran en esta US. |
| Tema visual | Claro, como el wireframe. Sacar el `prefers-color-scheme: dark` del scaffold. |
| Usuarios de otros roles | El seed demo crea Persona + Usuario. No crear filas en `medico` ni `paciente`. |

## 3. Mensajes exactos (español)

Usar estos textos. No parafrasear.

| Caso | Texto |
| --- | --- |
| Email vacío | Ingresá tu correo. |
| Contraseña vacía | Ingresá tu contraseña. |
| Email inexistente, contraseña incorrecta, o cuenta inactiva con contraseña incorrecta | El correo o la contraseña no coinciden. Revisalos e intentá otra vez. |
| Contraseña correcta y `activo = false` | Esta cuenta está desactivada. Contactá a Administración. |
| Clave temporal vacía | Ingresá la clave temporal. |
| Nueva clave de menos de 8 caracteres | La nueva contraseña debe tener al menos ocho caracteres. |
| Repetición distinta | La repetición no coincide. |
| Nueva igual a la temporal | La nueva contraseña tiene que ser distinta de la temporal. |
| Temporal incorrecta | La clave temporal no coincide. |
| Aviso del login | Las cuentas las crea Administración. Si todavía no tenés acceso, acercate al mostrador. |
| Página recuperar | La recuperación se hace de forma presencial con Administración. No hay recuperación por email. |
| Acceso restringido | Tu rol no tiene permiso para abrir esta pantalla. |
| Placeholder de otra US | Esta función se incorpora en otra historia de usuario. |

Auditoría, campo `accion` (copiar literal, caben en `varchar(80)`):

- `Inicio de sesión`
- `Cierre de sesión`
- `Cambio de clave temporal`

`entidad` = `usuario`. `referenciaId` = id del usuario. `detalle` = null. Nunca guardar la contraseña en `detalle`.

## 4. Rutas

| URL | Quién entra | Qué muestra |
| --- | --- | --- |
| `/` | cualquiera | Si no hay sesión válida, redirect a `/login`. Si hay clave temporal, redirect a `/cambiar-clave`. Si no, redirect al inicio del rol. |
| `/login` | público | Formulario. Si ya hay sesión válida, redirect al destino de arriba. |
| `/recuperar` | público | Solo texto informativo y un enlace "Volver a ingresar" a `/login`. Sin formulario que cambie la clave. |
| `/cambiar-clave` | sesión válida con `claveTemporal = true` | Formulario. Si no hay sesión, redirect a `/login`. Si la sesión no tiene clave temporal, redirect al inicio del rol. |
| `/admin` | rol `ADMIN` | Inicio de administración. |
| `/admin/pacientes` | `ADMIN` | Placeholder. |
| `/admin/parametros` | `ADMIN` | Placeholder. |
| `/medico` | `MEDICO` | Inicio médico. |
| `/medico/disponibilidad` | `MEDICO` | Placeholder. |
| `/enfermeria` | `ENFERMERIA` | Inicio de enfermería. |
| `/paciente` | `PACIENTE` | Inicio de paciente. |
| `/paciente/buscar` | `PACIENTE` | Placeholder. |
| `/paciente/turnos` | `PACIENTE` | Placeholder. |
| `/sin-permiso` | cualquier sesión válida sin clave temporal | Mensaje de acceso restringido y enlace al propio inicio. |

Inicio por rol:

- `ADMIN` → `/admin`
- `MEDICO` → `/medico`
- `ENFERMERIA` → `/enfermeria`
- `PACIENTE` → `/paciente`

Etiquetas de rol en la UI: Administrador, Médico, Enfermería, Paciente.

Nav visible (solo la del rol de la sesión; no renderizar links de otros roles):

- Admin: Inicio `/admin`, Pacientes `/admin/pacientes`, Parámetros `/admin/parametros`.
- Médico: Agenda `/medico`, Disponibilidad `/medico/disponibilidad`.
- Enfermería: Inicio `/enfermeria`.
- Paciente: Inicio `/paciente`, Buscar turno `/paciente/buscar`, Mis turnos `/paciente/turnos`.

El ítem de la URL actual lleva `aria-current="page"`.

## 5. Árbol de archivos a crear o reemplazar

```
src/lib/auth/constants.ts
src/lib/auth/password.ts
src/lib/auth/session.ts
src/lib/auth/guards.ts
src/lib/auth/audit.ts
src/app/actions/auth.ts
src/proxy.ts
src/components/public-shell.tsx
src/components/app-shell.tsx
src/components/logout-button.tsx
src/app/page.tsx                          # reemplazar el scaffold de Next
src/app/login/page.tsx
src/app/login/login-form.tsx
src/app/recuperar/page.tsx
src/app/cambiar-clave/page.tsx
src/app/cambiar-clave/cambiar-clave-form.tsx
src/app/(app)/layout.tsx
src/app/(app)/sin-permiso/page.tsx
src/app/(app)/admin/layout.tsx
src/app/(app)/admin/page.tsx
src/app/(app)/admin/pacientes/page.tsx
src/app/(app)/admin/parametros/page.tsx
src/app/(app)/medico/layout.tsx
src/app/(app)/medico/page.tsx
src/app/(app)/medico/disponibilidad/page.tsx
src/app/(app)/enfermeria/layout.tsx
src/app/(app)/enfermeria/page.tsx
src/app/(app)/paciente/layout.tsx
src/app/(app)/paciente/page.tsx
src/app/(app)/paciente/buscar/page.tsx
src/app/(app)/paciente/turnos/page.tsx
```

Borrar `src/lib/auth/.gitkeep` y `src/app/api/auth/.gitkeep` si molestan. No borrar `src/lib/db/prisma.ts`.

Un layout de rol solo llama a `requireRole` y renderiza `children`. La página de inicio saluda con el nombre y dice que el resto llega en otras historias. El placeholder muestra el título de la sección y el texto de la tabla de mensajes.

## 6. Contratos de código

### 6.1 `src/lib/auth/constants.ts`

```ts
export const COOKIE_SESION = "sigsam_sesion";
export const INACTIVIDAD_MS = 15 * 60 * 1000;
export const TOQUE_MS = 60 * 1000;
export const COOKIE_MAX_AGE_SEG = 12 * 60 * 60;

export const INICIO_POR_ROL = {
  ADMIN: "/admin",
  MEDICO: "/medico",
  ENFERMERIA: "/enfermeria",
  PACIENTE: "/paciente",
} as const;

export const ETIQUETA_ROL = {
  ADMIN: "Administrador",
  MEDICO: "Médico",
  ENFERMERIA: "Enfermería",
  PACIENTE: "Paciente",
} as const;
```

`Rol` se importa del cliente generado. Si `import { Rol } from "@/generated/prisma/client"` no compila, importarlo desde `@/generated/prisma/enums`. No inventar un union type paralelo.

### 6.2 `src/lib/auth/password.ts`

- `normalizarEmail(email: string): string` → `email.trim().toLowerCase()`.
- `hashearPassword(password: string): Promise<string>` → `bcrypt.hash(password, 10)`.
- `verificarPassword(password: string, hash: string): Promise<boolean>` → `bcrypt.compare`.
- Constante `HASH_DUMMY`: un hash bcrypt real de cost 10, pegado en el archivo. Generarlo una vez con `node -e "require('bcryptjs').hash('dummy-sigsam', 10).then(console.log)"` y commitear solo el hash, no la frase. Sirve para comparar cuando el email no existe, así el tiempo no delata si la cuenta existe. No llamar a `bcrypt.hash` en cada login fallido.

Import: `import bcrypt from "bcryptjs"`.

### 6.3 `src/lib/auth/session.ts`

Tipo que puede cruzar al cliente (sin `BigInt`):

```ts
export type SesionActual = {
  sesionId: string;
  usuarioId: string;
  email: string;
  nombre: string;
  rol: Rol;
  claveTemporal: boolean;
};
```

Funciones:

- `hashToken(token: string): string` → `createHash("sha256").update(token).digest("hex")` de `node:crypto`.
- `crearSesion(usuarioId: bigint): Promise<void>`
  1. `randomBytes(32).toString("base64url")`.
  2. Insertar `sesion` con `tokenHash`, `usuarioId`, `creadaEn` y `ultimaActividad` en `new Date()`. `finalizadaEn` queda null.
  3. `const jar = await cookies()` y `jar.set(COOKIE_SESION, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: COOKIE_MAX_AGE_SEG })`.
  4. Esta función solo se llama desde una Server Action.
- `cerrarSesionActual(): Promise<SesionActual | null>`
  1. Leer la cookie. Si no hay, devolver null.
  2. Buscar la fila por `tokenHash` incluyendo `usuario`.
  3. Si existe y `finalizadaEn` es null, setear `finalizadaEn = new Date()`.
  4. `jar.delete(COOKIE_SESION)`.
  5. Devolver la sesión si la fila existía, para que el logout pueda auditar. Si no existía, null.
- `getSession(): Promise<SesionActual | null>`
  1. Leer la cookie con `await cookies()`. Si no hay valor, null.
  2. Buscar `sesion` por `tokenHash`, con `usuario` y `usuario.persona`.
  3. Si no hay fila, o `finalizadaEn` no es null, null. No intentes borrar la cookie acá: `cookies().delete` no está permitido en un Server Component.
  4. Si `usuario.activo` es false, setear `finalizadaEn` y devolver null.
  5. Si `Date.now() - ultimaActividad.getTime() > INACTIVIDAD_MS`, setear `finalizadaEn` y devolver null.
  6. Si `Date.now() - ultimaActividad.getTime() >= TOQUE_MS`, actualizar `ultimaActividad` a `new Date()`. No actualizar en cada request: como máximo una vez por minuto.
  7. Devolver el objeto `SesionActual` con ids en `String(...)`.

`getSession` se usa en layouts y páginas. Puede escribir en la base. No puede escribir la cookie.

### 6.4 `src/lib/auth/guards.ts`

- `requireSession(): Promise<SesionActual>` → `getSession()`; si es null, `redirect("/login")`.
- `requireRole(rol: Rol): Promise<SesionActual>` → `requireSession()`; si `claveTemporal`, `redirect("/cambiar-clave")`; si `rol` no coincide, `redirect("/sin-permiso")`.
- `destinoPostLogin(sesion: SesionActual): string` → si `claveTemporal`, `"/cambiar-clave"`; si no, `INICIO_POR_ROL[sesion.rol]`.

`redirect` de `next/navigation` lanza una excepción. No lo envuelvas en `try/catch`. Si una acción necesita `try/catch` por la base, el `redirect` va después del `try`, o se re-lanza.

### 6.5 `src/lib/auth/audit.ts`

```ts
export async function registrarAuditoria(input: {
  actorId: bigint;
  accion: "Inicio de sesión" | "Cierre de sesión" | "Cambio de clave temporal";
  referenciaId: bigint;
}): Promise<void>
```

Crea una fila `auditoria` con `entidad: "usuario"` y `detalle: null`. Un fallo de auditoría no debe impedir el login: capturar el error, no loguear datos sensibles, y seguir. No auditar el vencimiento por inactividad (genera ruido).

### 6.6 `src/app/actions/auth.ts`

Primera línea: `"use server"`.

Tipo de estado de formulario:

```ts
export type EstadoFormulario = {
  error?: string;
  campos?: {
    email?: string;
    password?: string;
    temporal?: string;
    nueva?: string;
    confirmacion?: string;
  };
};
```

`login(_prev: EstadoFormulario, formData: FormData): Promise<EstadoFormulario>`

1. Leer `email` y `password` como string. Si falta el email o queda vacío tras `trim`, devolver el error de campo. Igual con la contraseña. No consultar la base en ese caso.
2. `normalizarEmail`.
3. `findUnique` de `usuario` por email, incluyendo `persona`.
4. Si no hay usuario, `verificarPassword(password, HASH_DUMMY)` y devolver el error genérico.
5. Si hay usuario, `verificarPassword(password, usuario.passwordHash)`.
6. Si no coincide, error genérico. No decir si el email existe ni si la cuenta está inactiva.
7. Si coincide y `activo` es false, devolver el mensaje de cuenta desactivada. No crear sesión.
8. Si coincide y está activa: `crearSesion(usuario.id)`, `registrarAuditoria` de inicio, y `redirect(usuario.claveTemporal ? "/cambiar-clave" : INICIO_POR_ROL[usuario.rol])`.

`logout(): Promise<void>`

1. `const sesion = await cerrarSesionActual()`.
2. Si `sesion` no es null, auditar cierre con `BigInt(sesion.usuarioId)`.
3. `redirect("/login")`.

`cambiarClave(_prev: EstadoFormulario, formData: FormData): Promise<EstadoFormulario>`

1. `const sesion = await getSession()`. Si es null, `redirect("/login")`. Si `claveTemporal` es false, `redirect(INICIO_POR_ROL[sesion.rol])`.
2. Leer `temporal`, `nueva`, `confirmacion`.
3. Validar vacíos y longitud antes de comparar el hash. Si `nueva !== confirmacion`, error de repetición. Si `nueva === temporal`, error de "distinta de la temporal" sin pegarle a la base.
4. Volver a leer el usuario por id (`BigInt(sesion.usuarioId)`). Si no está activo, cerrar la sesión y `redirect("/login")`.
5. Si la temporal no coincide con `passwordHash`, error "La clave temporal no coincide."
6. Por las dudas, `verificarPassword(nueva, passwordHash)`. Si coincide, el mismo error de "distinta de la temporal".
7. En una transacción: actualizar `passwordHash` y `claveTemporal: false`. No cerrar la sesión actual. No tocar otras sesiones.
8. Auditar `Cambio de clave temporal`.
9. `redirect(INICIO_POR_ROL[sesion.rol])`.

## 7. Proxy

Archivo `src/proxy.ts`, al mismo nivel que `src/app`. Export nombrado `proxy`. No uses Prisma ni `getSession`.

```ts
export function proxy(request: NextRequest) {
  const tieneCookie = request.cookies.has(COOKIE_SESION);
  const path = request.nextUrl.pathname;
  const esPublica = path === "/login" || path === "/recuperar";

  if (!tieneCookie && !esPublica) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}
```

No redirigir `/login` → `/` solo porque la cookie existe. Una cookie vieja no es una sesión válida; si el proxy la manda al inicio y el inicio la manda al login, hay un bucle.

Matcher (constante literal, no una variable):

```ts
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

`/cambiar-clave` y las rutas de rol no son públicas: sin cookie van a `/login`. La validez y el rol los resuelve el layout.

## 8. Páginas y layouts

### Layout raíz

Dejar `src/app/layout.tsx` como está en estructura (`lang="es"`, metadata SIGSAM). No envolver todo en el shell de la app: el login no lleva sidebar.

### `/`

Server Component. `getSession()`. Sin sesión → `redirect("/login")`. Con sesión → `redirect(destinoPostLogin(sesion))`. No renderiza UI.

### Login y recuperar

Usan `public-shell.tsx`: en `md+` grilla de dos columnas; debajo de `md` una columna. Aside con fondo `#102a31`, marca "+" y la palabra SIGSAM, título "Tu salud, con tiempo para vos." y el texto "Organizá tus turnos médicos desde un espacio claro y seguro." Main con la tarjeta del formulario. Referencia visual: `publicShell` en `docs/Wireframe Sprint 1.html`. No copies la barra de revisión del prototipo.

`login/page.tsx` es Server Component. Si `getSession()` devuelve sesión, `redirect(destinoPostLogin(sesion))`. Si no, renderiza el client form.

`login-form.tsx` es `"use client"` y usa `useActionState(login, {})`. Campos:

- `email`, type `email`, label "Correo electrónico", `autoComplete="username"`.
- `password`, type `password`, label "Contraseña", `autoComplete="current-password"`.
- Botón "Ingresar".
- Enlace a `/recuperar` con texto "Recuperar acceso".
- Aviso informativo con el texto de alta presencial.

Mostrar `estado.error` en un `role="alert"`. Si hay error de campo, `aria-invalid` en ese input y el texto debajo. Inputs de al menos 44px de alto. El botón ocupa el ancho del formulario en móvil.

### Cambiar clave

Página mínima, sin nav de funciones. Muestra el nombre y un `logout-button`. Texto: "Tenés que definir una nueva contraseña antes de continuar."

Campos: "Clave temporal" (`autoComplete="current-password"`), "Nueva contraseña" (`autoComplete="new-password"`, hint "Al menos 8 caracteres."), "Repetir contraseña" (`autoComplete="new-password"`). Botón "Guardar nueva clave".

### Shell de la app

`src/app/(app)/layout.tsx`:

1. `const sesion = await requireSession()`.
2. Si `sesion.claveTemporal`, `redirect("/cambiar-clave")`.
3. Renderizar `app-shell` con nombre, etiqueta de rol, nav de ese rol y `children`.

El shell copia la estructura del wireframe, no hace falta que sea pixel-perfect:

- Desktop: sidebar de 248px, fondo blanco, borde `#d7e2e4`, fondo de página `#f7f9fa`.
- Marca: cuadrado `#145f65` con "+" y texto SIGSAM que enlaza al inicio del rol.
- Nav con ítems de al menos 44px. El actual usa fondo `#eaf3f3` y texto `#145f65`.
- Topbar con miga "Rol / título", nombre, etiqueta de rol y botón "Cerrar sesión".
- A `max-md`: el sidebar pasa arriba, la nav es una fila con scroll horizontal, y se ocultan el rótulo del rol y el pie del sidebar. El contenido lleva padding 16px.

`logout-button.tsx` es un client component mínimo con `<form action={logout}>` o un `<button formAction={logout}>`. No hace falta JavaScript propio. Texto "Cerrar sesión". Estilo ghost, no un botón primario enorme.

Cada `layout.tsx` de rol:

```tsx
export default async function Layout({ children }: LayoutProps<"/admin">) {
  await requireRole("ADMIN");
  return children;
}
```

Usar el genérico `LayoutProps` de Next 16 con la ruta literal (`"/admin"`, `"/medico"`, `"/enfermeria"`, `"/paciente"`). No tipar `children: React.ReactNode` a mano.

`/sin-permiso` no tiene layout de rol. Muestra el mensaje de acceso restringido y un enlace "Volver al inicio" a `INICIO_POR_ROL[sesion.rol]`.

## 9. Estilos

En `src/app/globals.css`, definir el tema en `@theme inline` para poder usar utilidades de Tailwind:

- `--color-canvas: #f7f9fa`
- `--color-surface: #ffffff`
- `--color-ink: #18323a`
- `--color-muted: #52666d`
- `--color-line: #d7e2e4`
- `--color-brand: #145f65`
- `--color-brand-hover: #0b4a4e`
- `--color-brand-soft: #eaf3f3`
- `--color-danger: #b4393a`
- `--color-info: #286cb2`

Quitar el bloque `@media (prefers-color-scheme: dark)`. Fondo del body `#f7f9fa`, texto `#18323a`. No hace falta modo oscuro.

Botón primario: fondo `#145f65`, texto blanco, alto mínimo 44px, radio 8px. Hover `#0b4a4e`. Focus visible: outline 2px `#145f65`.

No uses los componentes ni las clases del scaffold (`bg-zinc-50`, logos de Next). Podés borrar el uso de `next/image` en `page.tsx` al reemplazarlo. No borres `public/*.svg` si no estorban.

## 10. Seed de demostración

Editar `prisma/seed.ts`. Hoy, si el admin ya existe, hace `return` y no crea a nadie más. Cambiarlo así:

1. Crear el admin solo si no existe el email. No pisar su hash ni su `claveTemporal` si ya existe (puede haber cambiado la clave).
2. Después, crear las cuentas que falten. Si el email ya existe, no actualizar la contraseña.

Bug existente: el seed usa `new PrismaPg({ connectionString })`. Esa forma conecta a localhost. Cambiarla a `new PrismaPg(connectionString)`, igual que `src/lib/db/prisma.ts`.

Cuentas demo, todas `activo: true`, solo `persona` + `usuario`:

| Email | Contraseña | Rol | claveTemporal | Nombre |
| --- | --- | --- | --- | --- |
| `admin@sigsam.local` | `Admin@1234` | `ADMIN` | `true` | Administrador SIGSAM |
| `medico@sigsam.local` | `Medico@1234` | `MEDICO` | `false` | Dra. Valeria Ruiz |
| `enfermeria@sigsam.local` | `Enfermeria@1234` | `ENFERMERIA` | `false` | Paula Medina |
| `paciente@sigsam.local` | `Paciente@1234` | `PACIENTE` | `true` | Juan Pérez |

El paciente demo queda con clave temporal para poder probar el CA3 sin gastar la clave del admin. El admin nuevo también nace con clave temporal (D-12).

Agregar estas cuatro filas a la tabla de credenciales del `README.md`, marcadas como datos de demostración. No escribas la contraseña de la base de Supabase.

Correr `npx prisma db seed` y comprobar que es idempotente: una segunda corrida no duplica filas ni resetea claves.

## 11. Documentar la decisión

Agregar al final de `docs/DECISIONES.md`:

## D-17 — Cookie de sesión y vencimiento por inactividad

- **Estado:** Aceptada (2026-10-04)
- **Decisión:** la cookie `sigsam_sesion` guarda un token opaco. La base guarda su SHA-256. La sesión vence a los 15 minutos sin requests que llamen a `getSession()`. La cookie tiene un tope de 12 horas y no es la fuente del vencimiento por inactividad.
- **Motivo:** CA4 de US-001. `cookies().set` no puede llamarse desde un Server Component, así que el tope de la cookie no se renueva en cada página; la inactividad se aplica en la fila `sesion`.
- **Consecuencia:** `src/proxy.ts` solo comprueba que la cookie exista. Una cookie presente no autoriza.

## 12. Orden de implementación

1. `constants.ts`, `password.ts` (incluido `HASH_DUMMY`), `audit.ts`, `session.ts`, `guards.ts`.
2. Server Actions.
3. Reemplazar `globals.css` y armar los dos shells.
4. `/login`, `/recuperar`, `/cambiar-clave`, `/`.
5. Grupo `(app)` con layouts de rol, inicios, placeholders y `/sin-permiso`.
6. `src/proxy.ts`.
7. Seed demo, README y D-17.
8. Verificación de la sección 13.

No empieces por la UI. Sin `getSession` correcto, las pantallas no pueden cumplir el CA4.

## 13. Verificación

Compuerta, en este orden:

```powershell
npm run format
npm run lint
npm run format:check
npm run build
npx prisma db seed
```

Las cuatro primeras tienen que terminar en 0. El seed, corrido dos veces, no duplica usuarios.

Checklist manual con `npm run dev`. Probar también el ancho de 390px.

- CA1. `no-existe@sigsam.local` / `cualquiera` → mensaje genérico, sin sesión.
- CA1. `medico@sigsam.local` / `mal` → el mismo mensaje genérico.
- CA1. Email `  Medico@SIGSAM.local  ` / `Medico@1234` entra igual que en minúsculas.
- CA1. Tras desactivar a mano `usuario.activo = false` en Studio, la contraseña correcta dice que la cuenta está desactivada y no crea sesión. Volvé a activarla al terminar.
- CA2. Médico entra a `/medico` y ve Agenda y Disponibilidad. No ve Pacientes ni Buscar turno.
- CA2. Con la sesión del médico, abrir `/admin` muestra "Tu rol no tiene permiso para abrir esta pantalla." No se ve contenido de administración.
- CA2. Paciente en `/paciente/turnos` ve el placeholder, no datos de otra persona.
- CA3. `paciente@sigsam.local` / `Paciente@1234` cae en `/cambiar-clave`. Pegar `/paciente` vuelve a `/cambiar-clave`.
- CA3. Nueva clave `corta` se rechaza. `Paciente@1234` repetida se rechaza por ser la temporal. `Paciente@5678` / `Paciente@5678` entra al inicio. Un segundo login con `Paciente@1234` falla; con `Paciente@5678` entra directo al inicio, sin pasar por cambiar clave.
- CA4. Cerrar sesión borra el acceso: `/paciente` redirige a `/login`. En la base, esa fila tiene `finalizada_en` y la auditoría tiene "Cierre de sesión".
- CA4. Iniciar sesión, en Studio poner `ultima_actividad` 16 minutos atrás, recargar una página autenticada: redirige a `/login` y la fila queda con `finalizada_en`. No queda una operación a medio guardar porque esta US no tiene escrituras de negocio además del propio cambio de clave.
- CA4. Con sesión abierta, poner `activo = false` y recargar: redirige a `/login` y la sesión queda finalizada. Reactivar la cuenta después.
- CA5. En 390px el login se lee en una columna, los inputs no se salen, y la nav del shell scrollea horizontal. En 1280px el login tiene aside y el shell tiene sidebar.

Además, en la base después de un login correcto:

- Existe una fila `sesion` con `token_hash` de 64 hex y `finalizada_en` null.
- La cookie del navegador se llama `sigsam_sesion`, es httpOnly, y su valor no es igual al `token_hash`.
- Hay una fila `auditoria` con acción `Inicio de sesión` y sin contraseña en `detalle`.

Si `npm run build` falla por un import de `Rol` o de `LayoutProps`, corregí el import contra `src/generated/prisma` y `node_modules/next/dist/docs/`. No bajes de versión Prisma ni Next para "arreglarlo".
