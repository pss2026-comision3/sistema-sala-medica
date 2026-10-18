# Plan de implementación — US-SIG-041 Administrar catálogo de obras sociales

Este documento especifica el alcance, las decisiones de diseño y la estrategia de verificación para implementar la administración del catálogo de obras sociales y prepagas de SIGSAM (RF-17).

> **Nota sobre el identificador:** `docs/Distribucion de USs por Sprint.md` también asigna US-SIG-041 a “Asignar sobreturno” y recomienda renumerar esta historia como US-SIG-042. Este plan conserva US-SIG-041 según el identificador solicitado; la colisión debe resolverse en el backlog antes de cerrar la documentación de Sprint 3.

---

## 0. Qué hacer y qué no hacer

Implementar únicamente el ABM de obras sociales/prepagas para el Administrador:

1. El Administrador accede a `/admin/obras-sociales` desde la navegación principal.
2. Consulta el catálogo completo, con nombre y estado (Activa/Inactiva).
3. Puede dar de alta una entidad, cambiar su nombre y activar o desactivar una entidad existente.
4. La desactivación es lógica: no elimina el registro ni las relaciones con pacientes o turnos.
5. Una obra social inactiva no se ofrece para nuevas asignaciones de cobertura. Las coberturas ya registradas se conservan.
6. Las operaciones de alta, cambio de nombre y estado quedan auditadas.

### Qué no hacer

- **No** borrar físicamente obras sociales, aunque estén inactivas.
- **No** permitir nombres vacíos, de más de 255 caracteres o duplicados ignorando mayúsculas/minúsculas.
- **No** habilitar el catálogo a roles distintos de `ADMIN`.
- **No** modificar la asignación de cobertura del paciente, la modalidad de turno ni los flujos de cobro (US-SIG-028, US-SIG-029 y US-SIG-030).
- **No** cambiar el esquema Prisma ni crear una migración: el modelo y la restricción de unicidad ya existen.
- **No** instalar dependencias adicionales.

---

## 1. Criterios de aceptación (US-SIG-041)

Historia según la distribución: *Como Administrador, quiero administrar el catálogo de obras sociales y prepagas para mantener disponibles las entidades de cobertura utilizadas por los pacientes.* El detalle siguiente operacionaliza el alcance “ABM de obras sociales/prepagas. Activa/Inactiva” y debe confirmarse con el responsable funcional.

- **CA1. Acceso y consulta.** Solo ADMIN puede acceder al catálogo. La pantalla lista entidades activas e inactivas e identifica claramente su estado.
- **CA2. Alta.** El Administrador puede crear una obra social con nombre obligatorio, recortado y de hasta 255 caracteres. No se admiten nombres duplicados sin distinguir mayúsculas/minúsculas.
- **CA3. Edición.** El Administrador puede cambiar el nombre de una entidad existente, aplicando las mismas reglas de validación y unicidad que en el alta.
- **CA4. Estado.** El Administrador puede activar una entidad inactiva o desactivar una activa. El cambio de estado no borra el registro ni sus relaciones.
- **CA5. Uso en coberturas.** Las entidades inactivas no se ofrecen para nuevas asignaciones. Desactivar una entidad no elimina ni invalida automáticamente una cobertura ya asociada a un paciente.
- **CA6. Auditoría.** Las altas, cambios de nombre y cambios de estado registran actor, operación y referencia a la obra social.

---

## 2. Decisiones de diseño y arquitectura

| Tema | Decisión |
| --- | --- |
| **Ubicación** | Ruta protegida `/admin/obras-sociales`, bajo `src/app/(app)/admin/obras-sociales/`. El layout de Administración ya requiere rol `ADMIN`; cada Server Action también debe verificarlo. |
| **Modelo** | Reutilizar `ObraSocial` con `id`, `nombre` y `activa`. No agregar campos ni migraciones. |
| **Unicidad** | Mantener la restricción de Prisma `@@unique([nombre])` y el índice funcional PostgreSQL sobre `lower(nombre)` de D-16. El servidor valida para dar feedback y traduce una colisión `P2002` para cubrir también carreras concurrentes. |
| **Baja lógica** | Cambiar `activa` entre `true` y `false`. No se implementa borrado físico porque `Paciente` y `Turno` conservan referencias a la entidad. |
| **Cobertura existente** | La desactivación no modifica `Paciente.obraSocialId`, `plan` ni `numeroAfiliado`. La regla actual de alta de pacientes ya lista y acepta solo obras sociales activas. |
| **Auditoría** | Reutilizar `registrarAuditoria` con el Administrador como actor, entidad `obra_social`, referencia al ID y detalle sin datos de afiliación de pacientes. Agregar acciones a `AUDITORIA` si todavía no existen. |
| **Serialización** | Enviar al componente cliente el ID como `string`; no pasar `BigInt` de Prisma directamente. |
| **Dependencias** | No agregar paquetes. Reutilizar Zod, Server Actions y los componentes/estilos existentes. |

---

## 3. Mensajes de interfaz

Usar estos textos o equivalentes consistentes con el catálogo de mensajes de la aplicación; confirmar el texto final con el responsable funcional.

| Caso | Texto |
| --- | --- |
| **Título** | Obras sociales y prepagas |
| **Nombre requerido** | Ingresá el nombre de la obra social. |
| **Nombre demasiado largo** | El nombre admite hasta 255 caracteres. |
| **Nombre duplicado** | Ya existe una obra social con ese nombre. |
| **Registro no encontrado** | La obra social solicitada no existe. |
| **Alta exitosa** | Obra social creada con éxito. |
| **Edición exitosa** | Nombre actualizado con éxito. |
| **Estado actualizado** | Estado actualizado con éxito. |
| **Sin entidades** | Todavía no hay obras sociales en el catálogo. |
| **Error inesperado** | No se pudo guardar el cambio. Intentá nuevamente. |

---

## 4. Rutas y navegación

| URL | Acceso | Propósito |
| --- | --- | --- |
| `/admin/obras-sociales` | Solo `ADMIN` | Consultar y administrar entidades activas e inactivas. |
| `/sin-permiso` | Otros roles autenticados | Destino estándar del guard cuando el rol no es ADMIN. |

Agregar el enlace “Obras sociales” a `NAV_POR_ROL.ADMIN` en `src/components/app-shell.tsx`. No agregar enlaces para otros roles.

---

## 5. Árbol de archivos a crear o modificar

```text
src/
  app/
    actions/
      obras-sociales.ts                 # NUEVO: alta, edición de nombre y cambio de estado
    (app)/
      admin/
        obras-sociales/
          page.tsx                       # NUEVO: carga el catálogo y protege la vista
          obras-sociales-view.tsx         # NUEVO: listado, formularios y estados de UI
  components/
    app-shell.tsx                        # MOD: agregar enlace al menú ADMIN
  lib/
    auth/
      constants.ts                       # MOD: acciones de auditoría y mensajes, si faltan
      audit.ts                            # Reutilizar registrarAuditoria sin cambios previstos
    validations/
      obras-sociales.ts                   # NUEVO: esquema Zod para nombre e IDs
    auth/guards.ts                        # Reutilizar requireRole("ADMIN")
  prisma/
    schema.prisma                         # Sin cambios: modelo ObraSocial existente
    migrations/20261004225559_init/
      migration.sql                       # Sin cambios: índice case-insensitive de D-16
docs/
  PLAN-US-041.md                          # Este documento
```

Integración existente que se debe conservar y comprobar:

- `src/app/(app)/admin/pacientes/page.tsx` consulta únicamente obras sociales activas para el alta.
- `src/app/actions/pacientes.ts` valida en servidor que la obra social elegida continúe activa.
- `prisma/schema.prisma` relaciona `ObraSocial` con pacientes y turnos; por ello no corresponde un borrado físico.

---

## 6. Contratos de implementación

### 6.1 Validación

Crear `src/lib/validations/obras-sociales.ts` con un esquema para el nombre:

- Recortar espacios externos.
- Requerir al menos un carácter luego del recorte.
- Limitar a 255 caracteres, en correspondencia con `VarChar(255)`.
- Validar los IDs de entrada antes de convertirlos a `BigInt`.

La comparación previa de duplicados puede ayudar al feedback, pero el índice único de base de datos es la garantía final. Manejar `Prisma.PrismaClientKnownRequestError` con código `P2002` en alta y edición.

### 6.2 Server Actions (`src/app/actions/obras-sociales.ts`)

Exponer operaciones equivalentes a:

```ts
crearObraSocial(input: { nombre: string })
actualizarNombreObraSocial(input: { id: string; nombre: string })
cambiarEstadoObraSocial(input: { id: string; activa: boolean })
```

Cada operación debe:

1. Ejecutar `requireRole("ADMIN")`.
2. Validar y normalizar la entrada en servidor.
3. Verificar la existencia del registro para edición/cambio de estado y responder con un error controlado si no existe.
4. Persistir solo los campos propios de la operación; el cambio de estado no debe borrar ni modificar relaciones.
5. Registrar auditoría con actor, entidad `obra_social`, referencia al ID y detalle de la operación. No incluir información de pacientes.
6. Manejar el error de unicidad case-insensitive sin exponer errores internos de Prisma.
7. Revalidar `/admin/obras-sociales`; revalidar `/admin/pacientes` cuando corresponda para reflejar la lista activa en una vista ya cacheada.

La función de auditoría actual no debe bloquear el flujo principal si el registro de auditoría falla, de acuerdo con el patrón existente.

### 6.3 Interfaz

- La página Server Component carga todas las entidades, ordenadas por nombre, y serializa `id` como texto.
- La vista presenta nombre y estado en un listado único, con controles accesibles para editar nombre y activar/desactivar.
- El alta y la edición muestran errores de validación y duplicidad junto al formulario; los cambios exitosos actualizan el listado y muestran confirmación.
- La acción de estado identifica claramente la consecuencia (“Desactivar” o “Activar”) y el estado resultante.
- No ofrecer acción “Eliminar”.

---

## 7. Cómo verificar el flujo

El `package.json` no declara un script de tests automatizados. Ejecutar las compuertas disponibles:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Con una base de datos de desarrollo disponible, verificar manualmente:

1. ADMIN puede abrir la ruta y los demás roles son rechazados.
2. Crear una entidad con un nombre válido y comprobar que aparece activa.
3. Rechazar nombre vacío, solo espacios, mayor a 255 caracteres y duplicado variando mayúsculas/minúsculas.
4. Editar el nombre y comprobar duplicidad contra otra entidad.
5. Desactivar y reactivar; comprobar que el registro permanece en el catálogo.
6. Comprobar que una entidad inactiva ya no se ofrece en el alta de pacientes, que la acción de paciente rechaza una selección inactiva y que una cobertura previamente asociada se conserva.
7. Revisar las entradas de auditoría de alta, edición y cambio de estado.

---

## 8. Pendientes y límites

- Resolver la colisión del identificador US-SIG-041 con la historia “Asignar sobreturno”. Este plan no renumera otras historias ni modifica la distribución.
- Confirmar con el responsable funcional los criterios propuestos de edición, validación de longitud y auditoría, porque la distribución solo resume el alcance como “ABM” y estados “Activa/Inactiva”.
- La baja lógica no impide consultar ni conservar una cobertura histórica; la selección de una entidad inactiva para una nueva asignación sigue prohibida por las validaciones existentes.
- Quedan fuera de alcance el borrado físico, la modificación masiva de coberturas de pacientes y los flujos de cobro/facturación.