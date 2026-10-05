# Plan de implementación — US-SIG-006 Recuperar el acceso y cambiar la contraseña

Este archivo es la especificación detallada para implementar la historia US-SIG-006 en SIGSAM. Sigue el estándar de `docs/PLAN-US-001.md`. No agrega alcance innecesario. Si algo no está escrito acá, no lo inventes.

---

## 0. Qué hacer y qué no hacer

Implementar únicamente **US-SIG-006**. Al terminar la implementación:

1. **El Administrador** puede buscar cuentas activas (personal y pacientes) por nombre o correo electrónico desde su panel de administración y generar una contraseña temporal de forma asistida y presencial.
2. Al generar la clave temporal:
   - Solo se permite si la cuenta está **activa** (`activo = true`).
   - Se genera una clave temporal legible y segura (≥8 caracteres).
   - Se invalidan de inmediato **todas las sesiones abiertas** de ese usuario en la tabla `sesion` (`finalizada_en = now()`).
   - La contraseña anterior queda invalidada y reemplazada por el hash de la temporal (`clave_temporal = true`).
   - Se registra en la bitácora de auditoría (`accion: "Restablecimiento de contraseña"`, actor: Administrador, referencia: Usuario).
   - Se muestra en pantalla la clave generada para que el Administrador la entregue presencialmente al solicitante.
3. **El Usuario con clave temporal** al ingresar queda atrapado en el flujo de cambio obligatorio de contraseña (`/cambiar-clave` o `/recuperar`), donde debe definir una contraseña nueva (≥8 caracteres, confirmación idéntica y distinta de la temporal) antes de usar el sistema (consolidación de US-001 CA3).
4. **Cualquier usuario autenticado** (sin clave temporal) puede acceder a su pantalla de perfil/cuenta (`/cuenta/clave`) y cambiar voluntariamente su propia contraseña indicando la actual, validando longitud (≥8), confirmación y que sea distinta de la actual.
5. Las contraseñas **nunca** se almacenan en texto legible ni se escriben en logs ni en la tabla `auditoria`.
6. La interfaz funciona en navegador de escritorio y en pantallas móviles (ancho mínimo 390px).

### No hacer:
- **No** implementar recuperación automática por correo electrónico, enlaces mágicos ni envío de emails (el requerimiento prohíbe explícitamente la recuperación por email).
- **No** permitir restablecer cuentas desactivadas (`activo = false`).
- **No** reactivar cuentas ni alterar roles durante el restablecimiento (CA5).
- **No** consultar ni mostrar la contraseña anterior de ningún usuario (es un hash unidireccional).
- **No** registrar contraseñas en `auditoria.detalle` ni en `console.log`.
- **No** instalar dependencias adicionales (usar las existentes: React 19, Next 16, Prisma 7, bcryptjs, Tailwind v4).
- **No** usar componentes externos ni librerías de UI ajenas al proyecto.

---

## 1. Criterios de Aceptación (US-SIG-006)

Texto de la historia: *Como usuario, quiero recuperar el acceso con ayuda de administración y establecer mi contraseña, para volver a utilizar mi cuenta.*

- **CA1.** Administración identifica presencialmente al solicitante y restablece únicamente una cuenta activa. No consulta ni revela la contraseña anterior.
- **CA2.** Se entrega una contraseña temporal, se invalidan la anterior y las sesiones abiertas, y se registra quién realizó el restablecimiento.
- **CA3.** En el siguiente ingreso se solicita una contraseña nueva de al menos ocho caracteres, distinta de la temporal, y su repetición antes de habilitar el resto del sistema.
- **CA4.** Una persona autenticada puede cambiar su propia contraseña introduciendo la actual. Las contraseñas no se incluyen en la bitácora.
- **CA5.** Restablecer una contraseña no reactiva cuentas ni cambia el rol. No se ofrece recuperación automática por email.

---

## 2. Decisiones de diseño y arquitectura

| Tema | Decisión |
| --- | --- |
| **Ubicación del restablecimiento asistido** | Sección en `/admin` (panel de Administrador) para buscar cuentas activas por nombre o email y disparar la acción "Generar clave temporal". |
| **Generación de clave temporal** | Función utilitaria criptográficamente segura en servidor (`crypto.randomBytes`) con formato legible de 10 caracteres (ej. `Tmp-XXXXXX` o alfanumérica segura), garantizando siempre ≥ 8 caracteres. |
| **Invalidación de sesiones previas** | `prisma.sesion.updateMany` marcando `finalizadaEn = new Date()` para todas las sesiones no finalizadas del usuario restablecido. |
| **Cambio voluntario de clave (CA4)** | Ruta protegida `/cuenta/clave` (dentro del grupo `(app)`). Enlace accesible en el `AppShell` (topbar junto al nombre de usuario). |
| **Validaciones de cambio voluntario** | Requiere contraseña actual correcta (`bcrypt.compare`), nueva contraseña de al menos 8 caracteres, confirmación idéntica y que la nueva sea distinta de la actual. |
| **Sesión tras cambio voluntario** | Se mantiene la sesión actual del usuario activa; no se expulsa al usuario tras un cambio exitoso. |
| **Auditoría (acciones exactas)** | `"Restablecimiento de contraseña"` (actor: Admin, ref: Usuario)<br>`"Cambio voluntario de contraseña"` (actor: Usuario, ref: Usuario)<br>`"Cambio de clave temporal"` (actor: Usuario, ref: Usuario) |
| **Entidad y detalle de auditoría** | `entidad: "usuario"`, `detalle: null`. Prohibido almacenar contraseñas o fragmentos de las mismas en `detalle`. |

---

## 3. Mensajes exactos (español)

Usar estos textos literales sin parafrasear:

| Caso | Texto |
| --- | --- |
| **Búsqueda vacía / sin resultados** | No se encontraron cuentas activas con ese criterio. |
| **Cuenta inexistente o inactiva en restablecimiento** | Solo se pueden restablecer cuentas que se encuentren activas. |
| **No autorizado para restablecer** | Tu rol no tiene permiso para restablecer contraseñas. |
| **Éxito al generar clave temporal** | Clave temporal generada con éxito. Entregale estas credenciales en mano al solicitante. |
| **Contraseña actual vacía** | Ingresá tu contraseña actual. |
| **Contraseña actual incorrecta** | La contraseña actual no coincide. |
| **Nueva contraseña vacía** | Ingresá la nueva contraseña. |
| **Nueva contraseña corta (< 8 caracteres)** | La nueva contraseña debe tener al menos ocho caracteres. |
| **Repetición de contraseña no coincide** | La repetición no coincide. |
| **Nueva contraseña igual a la actual** | La nueva contraseña tiene que ser distinta de la actual. |
| **Éxito al cambiar contraseña propia** | Tu contraseña se actualizó correctamente. |
| **Aviso de recuperación presencial** | La recuperación se realiza de forma presencial con Administración. No hay recuperación por email. |

---

## 4. Rutas y navegación

| URL | Acceso | Propósito |
| --- | --- | --- |
| `/admin` | Solo `ADMIN` | Dashboard de administración con buscador de cuentas para restablecimiento presencial y botón "Generar clave temporal". |
| `/cuenta/clave` | Cualquier sesión activa sin clave temporal | Pantalla de cambio voluntario de contraseña (CA4). Accesible desde el `AppShell`. |
| `/cambiar-clave` | Sesión activa con `claveTemporal = true` | Pantalla obligatoria de cambio de clave temporal (CA3). |
| `/recuperar` | Público | Pantalla informativa con el aviso de asistencia presencial y formulario directo para cambiar la clave temporal con el email. |

---

## 5. Árbol de archivos a crear o modificar

```
src/
  lib/
    auth/
      constants.ts               # Agregar constantes de auditoría y mensajes nuevos
      password.ts                # Agregar función generarClaveTemporal()
    actions/
      auth.ts                    # Server Actions: restablecerClavePorAdmin, cambiarPasswordVoluntario
  app/
    (app)/
      admin/
        page.tsx                 # Panel de admin con buscador de cuentas y acción de restablecimiento
        admin-cuentas-table.tsx  # Componente cliente con búsqueda y modal/tarjeta de credenciales generadas
      cuenta/
        clave/
          page.tsx               # Página de cambio voluntario de contraseña (CA4)
          cambiar-clave-propia-form.tsx # Formulario con validaciones y feedback de éxito/error
  components/
    app-shell.tsx                # Agregar enlace "Cambiar contraseña" a /cuenta/clave en topbar
docs/
  PLAN-US-006.md                 # Este documento de especificación
  DECISIONES.md                  # Registro de decisión D-18 (si aplica)
```

---

## 6. Contratos de código

### 6.1 `src/lib/auth/password.ts`
Agregar:
```ts
export function generarClaveTemporal(): string {
  // Genera clave temporal segura de 10 caracteres (ej: "Tmp7x9K2pQ")
  const bytes = randomBytes(6).toString("base64url");
  return `Tmp${bytes}`.slice(0, 10);
}
```

### 6.2 `src/lib/auth/constants.ts`
Extender `AUDITORIA` y `MSG`:
```ts
export const AUDITORIA = {
  INICIO: "Inicio de sesión",
  CIERRE: "Cierre de sesión",
  CAMBIO_TEMPORAL: "Cambio de clave temporal",
  RESTABLECIMIENTO_ADMIN: "Restablecimiento de contraseña",
  CAMBIO_VOLUNTARIO: "Cambio voluntario de contraseña",
} as const;

export const MSG = {
  // ... mensajes existentes ...
  SOLO_CUENTAS_ACTIVAS: "Solo se pueden restablecer cuentas que se encuentren activas.",
  PASSWORD_ACTUAL_REQUERIDO: "Ingresá tu contraseña actual.",
  PASSWORD_ACTUAL_INCORRECTO: "La contraseña actual no coincide.",
  IGUAL_A_ACTUAL: "La nueva contraseña tiene que ser distinta de la actual.",
  CAMBIO_VOLUNTARIO_EXITO: "Tu contraseña se actualizó correctamente.",
  CLAVE_TEMPORAL_GENERADA: "Clave temporal generada con éxito. Entregale estas credenciales en mano al solicitante.",
} as const;
```

### 6.3 Server Actions (`src/app/actions/auth.ts`)

#### A. Restablecimiento presencial por Administrador
```ts
export type ResultadoRestablecimiento = {
  error?: string;
  exito?: boolean;
  credenciales?: {
    nombre: string;
    email: string;
    claveTemporal: string;
  };
};

export async function restablecerClavePorAdmin(
  usuarioId: string
): Promise<ResultadoRestablecimiento>
```
1. Validar sesión del operador con `requireRole("ADMIN")`.
2. Buscar el usuario objetivo por `id: BigInt(usuarioId)` incluyendo `persona`.
3. Validar que exista y que `usuario.activo === true`. Si no está activo o no existe, devolver error `MSG.SOLO_CUENTAS_ACTIVAS`.
4. Generar clave temporal con `generarClaveTemporal()`.
5. Hashear la clave temporal con `hashearPassword()`.
6. En una transacción de Prisma:
   - Actualizar `usuario`: `passwordHash = hashTemporal`, `claveTemporal = true`.
   - Invalidar todas las sesiones abiertas del usuario: `sesion.updateMany` con `where: { usuarioId: usuario.id, finalizadaEn: null }`, `data: { finalizadaEn: new Date() }`.
   - Registrar auditoría: `accion = AUDITORIA.RESTABLECIMIENTO_ADMIN`, `actorId = BigInt(admin.usuarioId)`, `referenciaId = usuario.id`, `entidad = "usuario"`, `detalle = null`.
7. Devolver `{ exito: true, credenciales: { nombre: usuario.persona.nombreCompleto, email: usuario.email, claveTemporal } }`.

#### B. Cambio voluntario de contraseña (CA4)
```ts
export async function cambiarPasswordVoluntario(
  _prev: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario & { exito?: boolean }>
```
1. Obtener la sesión con `requireSession()`. Si tiene `claveTemporal === true`, redirigir a `/cambiar-clave`.
2. Leer campos `actual`, `nueva`, `confirmacion`.
3. Validar:
   - `actual` no vacía.
   - `nueva` ≥ 8 caracteres.
   - `nueva === confirmacion`.
   - `nueva !== actual`.
4. Obtener usuario de la base. Validar que esté activo.
5. Comparar `actual` con `usuario.passwordHash` mediante `verificarPassword`. Si no coincide, error `MSG.PASSWORD_ACTUAL_INCORRECTO`.
6. Encriptar nueva clave con `hashearPassword()`.
7. Actualizar `usuario.passwordHash`.
8. Registrar auditoría: `accion = AUDITORIA.CAMBIO_VOLUNTARIO`, `actorId = usuario.id`, `referenciaId = usuario.id`, `entidad = "usuario"`, `detalle = null`.
9. Retornar éxito para informar al usuario sin cerrar su sesión.

---

## 7. UI y Componentes

### 7.1 Panel de Administrador (`/admin`)
- Encabezado: Métricas básicas y título "Gestión de accesos y personal".
- Buscador reactivo por nombre o email.
- Tabla/lista de cuentas con:
  - Nombre completo y email.
  - Rol (Administrador, Médico, Enfermería, Paciente).
  - Estado (Activa / Desactivada).
  - Botón "Generar clave temporal" (habilitado solo en cuentas activas).
- Modal o panel de confirmación antes de restablecer:
  - Texto: *"Se entregará una nueva clave temporal a [Nombre]. Todas sus sesiones abiertas se cerrarán de inmediato y la contraseña anterior dejará de funcionar."*
- Al completar, tarjeta destacada de credenciales:
  - *"Credenciales para entregar: [Nombre] · Email: [email] · Clave temporal: [clave] · El cambio será obligatorio al ingresar."*
  - Botón para copiar o cerrar.

### 7.2 Pantalla de cambio voluntario (`/cuenta/clave`)
- Layout: integrado en el `AppShell`.
- Tarjeta de formulario centrada:
  - Título: "Cambiar mi contraseña".
  - Descripción: "Modificá tu contraseña actual por una nueva de al menos 8 caracteres."
  - Inputs:
    - Contraseña actual (password)
    - Nueva contraseña (password, hint: "Al menos 8 caracteres")
    - Repetir nueva contraseña (password)
  - Botón: "Actualizar contraseña".
  - Banner de éxito accesible (`role="status"`): "Tu contraseña se actualizó correctamente."

---

## 8. Estilos y accesibilidad

- Colores y tokens de Tailwind v4 definidos en `globals.css`:
  - Canvas: `#f7f9fa`, Surface: `#ffffff`, Line: `#d7e2e4`, Ink: `#18323a`, Brand: `#145f65`.
- Todos los inputs interactivos deben tener un alto mínimo de 44px (`min-h-[44px]`).
- Los mensajes de error utilizan `role="alert"` y `aria-invalid="true"`.
- Los mensajes de éxito utilizan `role="status"`.
- En dispositivos móviles (<768px), los formularios se adaptan a 1 sola columna ocupando el ancho completo.

---

## 9. Datos de prueba / seed

Utilizar las cuentas existentes del seed demo (`prisma/seed.ts`):
- Administrador: `admin@sigsam.local` (clave demo: `Admin@1234` o definida en primer cambio).
- Médico: `medico@sigsam.local` (clave demo: `Medico@1234`).
- Enfermería: `enfermeria@sigsam.local` (clave demo: `Enfermeria@1234`).
- Paciente: `paciente@sigsam.local` (clave demo: `Paciente@1234`).

---

## 10. Documentar la decisión

Agregar a `docs/DECISIONES.md`:
### D-18 — Restablecimiento asistido presencial y cambio voluntario de contraseña
- **Estado:** Aceptada (2026-10-05)
- **Decisión:** El restablecimiento de contraseñas es exclusivamente asistido y presencial por un Administrador, generando una clave temporal aleatoria (≥8 caracteres) e invalidando de inmediato todas las sesiones activas en la tabla `sesion`. Los usuarios autenticados disponen de la ruta `/cuenta/clave` para el cambio voluntario de contraseña validando la contraseña actual.
- **Motivo:** Cumplimiento de CA1, CA2, CA4 y CA5 de US-006 y RF-07. No existe restablecimiento automático por email.

---

## 11. Orden de implementación

1. Extender constantes y mensajes en `src/lib/auth/constants.ts`.
2. Incorporar `generarClaveTemporal()` en `src/lib/auth/password.ts`.
3. Crear Server Actions `restablecerClavePorAdmin` y `cambiarPasswordVoluntario` en `src/app/actions/auth.ts`.
4. Implementar vista de cambio voluntario en `/cuenta/clave` (`page.tsx` y `cambiar-clave-propia-form.tsx`).
5. Agregar enlace a `/cuenta/clave` en `src/components/app-shell.tsx`.
6. Implementar en `/admin` el buscador de cuentas y la acción de restablecimiento asistido con panel de credenciales.
7. Agregar D-18 en `docs/DECISIONES.md`.
8. Ejecutar compuertas de verificación y checklist manual.

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

- **CA1.** Entrar como `admin@sigsam.local`. En `/admin`, buscar a la médica `medico@sigsam.local`. Se visualizan sus datos sin revelar ninguna contraseña previa.
- **CA1 & CA5.** Probar una cuenta desactivada: el botón de generar clave temporal no debe permitir la acción o mostrará el error de cuenta inactiva.
- **CA2.** Como Admin, hacer clic en "Generar clave temporal" para `medico@sigsam.local`.
  - Aparece la clave temporal generada en pantalla.
  - En Prisma Studio o SQL, la tabla `sesion` muestra que todas las sesiones previas de ese médico tienen `finalizada_en` no nulo.
  - La tabla `auditoria` registra una fila con `accion: "Restablecimiento de contraseña"`, `actor_id` del Admin y `referencia_id` del médico.
- **CA3.** Abrir una ventana incógnito e intentar loguearse como `medico@sigsam.local` con la clave temporal generada:
  - El sistema detecta `clave_temporal = true` y fuerza la redirección a `/cambiar-clave`.
  - No permite navegar a `/medico` hasta ingresar la nueva contraseña válida.
  - Al ingresar una nueva válida (ej. `Medico@5678`), se actualiza la clave y se accede a `/medico`.
- **CA4.** Con la sesión activa del médico, hacer clic en "Cambiar contraseña" en la barra superior:
  - Ingresar contraseña actual errónea → mensaje "La contraseña actual no coincide."
  - Ingresar nueva contraseña de 6 caracteres → mensaje "La nueva contraseña debe tener al menos ocho caracteres."
  - Ingresar nueva contraseña válida y confirmarla → mensaje "Tu contraseña se actualizó correctamente."
  - La sesión sigue activa sin expulsar al usuario.
  - En la tabla `auditoria` se registra la acción `Cambio voluntario de contraseña`.
- **CA5.** Verificar que el rol no cambia en ningún momento y que no existe ningún botón o mecanismo de envío por email.
