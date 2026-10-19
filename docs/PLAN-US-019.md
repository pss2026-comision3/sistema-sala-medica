# Plan de implementación — US-SIG-019 Adjuntar documentación a una consulta propia

Este documento especifica la arquitectura, diseño, reglas de negocio y estrategia de pruebas para implementar la historia de usuario **US-SIG-019** en SIGSAM.

> **Estado:** Plan (sin implementación). Rama de trabajo: `feature/us-019-adjuntar-documentacion-consulta` (desde `stage`).

---

## 0. Qué hacer y qué no hacer

### Qué hacer:
1. **El Médico autor** puede adjuntar archivos a una **consulta propia ya guardada** (US-SIG-017), desde la ficha de la cita en `/medico/turnos/[id]`, una vez que la consulta existe.
2. Cada adjunto requiere:
   - **Nombre descriptivo** (obligatorio, hasta 255 caracteres).
   - **Archivo** en formato **PDF, JPG o PNG**.
   - **Tamaño máximo de 10 MB**.
3. Validar **tipo y tamaño antes** de incorporar el archivo. Una carga fallida **no** crea un adjunto incompleto ni una fila en `adjunto`.
4. Persistir el archivo en el **filesystem privado del servidor** (D-02) y registrar la fila `adjunto` con `nombre`, `ruta_privada`, `mime_type`, `tamano_bytes` y `creado_en`. El autor, la consulta y la fecha de la atención se conservan intactos.
5. Un adjunto incorporado **después** de la consulta queda **identificado por su propia fecha de incorporación** (`adjunto.creado_en`) y **no modifica** `consulta.creada_en` ni ningún dato de la atención.
6. **El autor** puede **consultar y descargar** su archivo.
7. **El paciente (o su tutor vigente)** puede **visualizar** el archivo en el portal (solo lectura), sin opción de descarga clínica desde su interfaz.
8. Los adjuntos son **inmutables**: no se reemplazan ni se eliminan. Un error se aclara mediante una **corrección** (US-SIG-018) y, si corresponde, un **archivo adicional**.
9. Otros profesionales, `ADMIN` y `ENFERMERIA` **no tienen acceso** a estos archivos.
10. Registrar evento de **auditoría** por cada incorporación exitosa.

### Qué no hacer:
- **No** permitir adjuntar archivos a una consulta que no exista o que no sea propia.
- **No** permitir adjuntar si el archivo no cumple tipo/tamaño (validación cliente + servidor, y verificación de firma mágica en servidor).
- **No** persistir una fila `adjunto` si la escritura del archivo falla; limpiar el archivo si falla la inserción en la base.
- **No** permitir editar ni borrar adjuntos guardados (sin endpoints `UPDATE`/`DELETE`).
- **No** habilitar la carga por pacientes ni por tutores.
- **No** exponer los archivos bajo `public/` ni servirlos como estáticos; siempre a través de Route Handlers con autorización.
- **No** permitir descarga clínica desde la interfaz del paciente (solo visualización en línea).
- **No** modificar el esquema de base de datos (`prisma/schema.prisma` ya cuenta con el modelo `Adjunto`).
- **No** instalar dependencias adicionales (se usa `node:fs`, `node:path`, `node:crypto` y el cliente Prisma existente).

---

## 1. Criterios de Aceptación (US-SIG-019)

> **Como** médico, **quiero** incorporar estudios y documentos a mis consultas, **para** mantener disponible el material utilizado durante la atención.
>
> **Preguntas relacionadas:** P-11, P-51, P-52, P-53, P-54, P-55, P-56, P-64.

- **CA1.** El médico autor puede adjuntar archivos a una consulta propia guardada. Cada archivo requiere un nombre descriptivo, formato PDF, JPG o PNG y tamaño máximo de 10 MB.
- **CA2.** Se validan tipo y tamaño antes de incorporar el archivo. Una carga fallida no crea un adjunto incompleto.
- **CA3.** Se conservan autor, fecha, consulta y archivo original. Una incorporación posterior queda identificada como tal y no cambia la fecha de la atención.
- **CA4.** El autor puede consultar y descargar su archivo; paciente y tutor vigente pueden visualizarlo en el portal. No se habilita la carga por pacientes ni una descarga clínica desde su interfaz.
- **CA5.** No se reemplazan ni eliminan adjuntos guardados. Un error se aclara mediante una corrección y, si corresponde, un archivo adicional. Otros profesionales y el rol Administrador no tienen acceso a estos archivos.

---

## 2. Dependencias

- **US-SIG-017 (Registrar consulta médica):** condición previa. Solo se adjunta a una consulta ya guardada (`consulta` existente para el `turno_id`).
- **US-SIG-018 (Correcciones):** complementaria para aclarar errores de un adjunto (se referencia, no se implementa aquí).
- **US-SIG-020 (Consultar historial):** si se implementa después, debe reutilizar la visualización de adjuntos del portal definida en este plan.
- **D-02 (Supabase solo como Postgres):** los adjuntos viven en el **filesystem del servidor**, nunca en Supabase Storage.
- **D-03 (Prisma 7):** acceso a datos únicamente mediante Prisma; el modelo `Adjunto` ya existe.
- **D-13 (Ramas):** trabajo en `feature/us-019-adjuntar-documentacion-consulta`.

---

## 3. Decisiones de diseño y arquitectura

| Tema | Decisión |
| --- | --- |
| **Ubicación de la funcionalidad** | Ficha del médico `/medico/turnos/[id]` (Server Component) + formulario cliente `adjuntar-documento-form.tsx`. La visualización de adjuntos se integra en `consulta-detalle-view.tsx`. |
| **Almacenamiento** | Filesystem privado bajo `storage/adjuntos/consulta/<turnoId>/<uuid>.<ext>` (relativo a `process.cwd()`), fuera de `public/`. La ruta relativa se guarda en `adjunto.ruta_privada`. |
| **Nombre de archivo físico** | `crypto.randomUUID()` + extensión derivada del MIME validado. El **nombre descriptivo** del usuario se guarda en `adjunto.nombre` y no se usa en el path (evita path traversal). |
| **Validación de tipo** | Cliente: `accept` + filtro por `file.type` y extensión. Servidor: lista cerrada (`application/pdf`, `image/jpeg`, `image/png`) + verificación de **firma mágica** sobre los primeros bytes del buffer. |
| **Validación de tamaño** | Cliente y servidor: `file.size <= 10 * 1024 * 1024` (10 MB). |
| **Atomicidad carga/DB** | Validar todo primero. Escribir el archivo al disco; si la inserción en `adjunto` falla, borrar el archivo. Si la escritura falla, no se toca la base. No se crea fila incompleta. |
| **Inmutabilidad (CA5)** | No hay Server Action ni Route Handler de edición/eliminación. La UI no muestra botones de modificar/borrar. |
| **Autorización de carga** | `requireRole("MEDICO")`. El turno debe ser propio (`disponibilidad.profesionalId === sesion.usuarioId`) y tener consulta guardada. |
| **Autorización de descarga (médico)** | Route Handler `/api/medico/...`: rol `MEDICO` y `consulta.autorId === sesion.usuarioId`. Devuelve el archivo con `Content-Disposition: attachment` (descarga). |
| **Visualización (paciente/tutor)** | Route Handler `/api/paciente/...`: rol `PACIENTE` y turno perteneciente al titular o a un menor con tutoría vigente. Devuelve el archivo con `Content-Disposition: inline` y `Cache-Control: private, no-store`. Sin opción de descarga en la UI. |
| **Identificación de incorporación posterior (CA3)** | `adjunto.creado_en` registra cuándo se incorporó; `consulta.creada_en` (fecha de la atención) no se modifica. La UI muestra "Adjuntado el …" junto al adjunto. |
| **Auditoría** | Acción `AUDITORIA.REGISTRO_ADJUNTO_CONSULTA` con `actor_id` = médico, `entidad = "adjunto"`, `referencia_id = turno_id`. Sin datos clínicos sensibles en el detalle. |
| **Sin cambios de esquema** | El modelo `Adjunto` ya existe en `prisma/schema.prisma`. No se requiere migración. |

---

## 4. Mensajes exactos (español)

| Caso | Mensaje literal |
| --- | --- |
| **Nombre descriptivo vacío** | El nombre descriptivo del archivo es obligatorio. |
| **Nombre descriptivo largo** | El nombre descriptivo admite hasta 255 caracteres. |
| **Archivo no seleccionado** | Seleccioná un archivo para adjuntar. |
| **Tipo no permitido** | Solo se permiten archivos PDF, JPG o PNG. |
| **Tamaño excedido** | El archivo supera los 10 MB permitidos. |
| **Archivo corrupto / firma inválida** | El archivo no coincide con el formato declarado. |
| **Consulta no disponible o no propia** | La consulta no existe o no tenés autorización para adjuntar archivos. |
| **Éxito al adjuntar** | Documento adjuntado con éxito. |
| **Error al guardar** | No se pudo guardar el archivo. Intentá nuevamente. |
| **Sin permiso (rol)** | Tu rol no tiene permiso para adjuntar documentos a consultas. |
| **Botón de acción** | Adjuntar documento |
| **Guardando** | Adjuntando documento… |
| **Título de sección** | Documentación adjunta |
| **Sin adjuntos** | Esta consulta no tiene documentos adjuntos. |
| **Ver archivo (médico/paciente)** | Ver archivo |
| **Descargar (solo médico)** | Descargar |
| **Límite de tamaño (ayuda)** | PDF, JPG o PNG · hasta 10 MB. |

---

## 5. Rutas y navegación

| URL | Acceso | Propósito |
| --- | --- | --- |
| `/medico/turnos/[id]` | Solo `MEDICO` autor | Ficha de la cita: si existe consulta, muestra la consulta en solo lectura + sección "Documentación adjunta" + formulario de adjunto. |
| `/api/medico/consultas/[turnoId]/adjuntos/[adjuntoId]/archivo` | Solo `MEDICO` autor | Sirve el archivo para visualización/descarga del autor (`?download=1` fuerza descarga). |
| `/paciente/turnos/[id]` | `PACIENTE` (titular o tutor vigente) | Ficha de la cita del paciente: si existe consulta, muestra sección "Documentación adjunta" con enlaces de visualización en línea. |
| `/api/paciente/turnos/[turnoId]/adjuntos/[adjuntoId]/archivo` | `PACIENTE` (titular o tutor vigente) | Sirve el archivo en línea (`inline`) para visualización; sin descarga clínica. |
| `/sin-permiso` | Otros roles | Redirección 403 al intentar acceder a endpoints o fichas no autorizadas. |

---

## 6. Árbol de archivos a crear o modificar

```
src/
  lib/
    auth/
      constants.ts                                    # MOD: mensajes MSG y AUDITORIA.REGISTRO_ADJUNTO_CONSULTA
    turnos/
      adjuntos-clinicos.ts                            # NUEVO: tipos, validaciones y lectura de adjuntos
  app/
    actions/
      adjuntos.ts                                     # NUEVO: Server Action adjuntarDocumentoConsultaAction()
    api/
      medico/
        consultas/
          [turnoId]/
            adjuntos/
              [adjuntoId]/
                archivo/
                  route.ts                            # NUEVO: descarga/visualización para el médico autor
      paciente/
        turnos/
          [turnoId]/
            adjuntos/
              [adjuntoId]/
                archivo/
                  route.ts                            # NUEVO: visualización en línea para paciente/tutor
    (app)/
      medico/
        turnos/
          [id]/
            consulta-detalle-view.tsx                # MOD: listar adjuntos + formulario de adjunto
            adjuntar-documento-form.tsx             # NUEVO: Client Component de carga
            page.tsx                                # MOD: pasar adjuntos y turnoId al detalle
      paciente/
        turnos/
          [id]/
            page.tsx                                # MOD: sección "Documentación adjunta" (solo visualización)
docs/
  PLAN-US-019.md                                    # Este documento
  DECISIONES.md                                     # MOD (propuesta): registrar D-22
storage/                                             # NUEVO (runtime, gitignored): adjuntos privados
.gitignore                                           # MOD: ignorar /storage
prisma/
  (sin cambios: modelo Adjunto ya existe)
```

---

## 7. Contratos de código

### 7.1 Constantes y validaciones (`src/lib/turnos/adjuntos-clinicos.ts`)

```ts
export const ADJUNTO_MAX_BYTES = 10 * 1024 * 1024;

export const ADJUNTO_MIME_PERMITIDOS = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
} as const;

export type AdjuntoMime = keyof typeof ADJUNTO_MIME_PERMITIDOS;

export interface AdjuntoClinicoViewData {
  id: string;
  consultaTurnoId: string;
  nombre: string;
  mimeType: string;
  tamanoBytes: number;
  creadoEn: string; // ISO 8601
}

export function esMimeAdjuntoPermitido(
  mime: string,
): mime is AdjuntoMime {
  return Object.prototype.hasOwnProperty.call(
    ADJUNTO_MIME_PERMITIDOS,
    mime,
  );
}

export function extensionPorMime(mime: AdjuntoMime): string {
  return ADJUNTO_MIME_PERMITIDOS[mime];
}

/** Verifica la firma mágica del buffer según el MIME declarado. */
export function verificarFirmaMagica(
  buffer: Buffer,
  mime: AdjuntoMime,
): boolean;

/** Valida un File del navegador; devuelve mime/size o un mensaje de error. */
export function validarArchivoAdjunto(file: File):
  | { ok: true; mime: AdjuntoMime; size: number }
  | { ok: false; error: string };

export async function obtenerAdjuntosConsultaTurno({
  turnoId,
  medicoUsuarioId,
}: {
  turnoId: string;
  medicoUsuarioId: string;
}): Promise<AdjuntoClinicoViewData[] | null>;
// null si la consulta no existe o no es propia del médico.

export async function obtenerAdjuntosConsultaPaciente({
  turnoId,
  pacientePersonaId,
}: {
  turnoId: string;
  pacientePersonaId: string;
}): Promise<AdjuntoClinicoViewData[]>;
// Devuelve [] si no hay consulta/adjuntos o si el turno no pertenece al paciente.
```

### 7.2 Server Action (`src/app/actions/adjuntos.ts`)

```ts
"use server";

export type ResultadoAdjunto =
  | { exito: true; adjuntoId: string; mensaje: string }
  | { exito: false; error: string };

export async function adjuntarDocumentoConsultaAction(
  formData: FormData,
): Promise<ResultadoAdjunto> {
  // 1. requireRole("MEDICO")
  // 2. turnoId = formData.get("turnoId")?.toString().trim()
  // 3. nombre = formData.get("nombre")?.toString().trim() ?? ""
  //    - validar no vacío y <= 255
  // 4. archivo = formData.get("archivo")
  //    - debe ser instancia de File
  //    - validarArchivoAdjunto(archivo)
  // 5. Buscar turno con disponibilidad y consulta
  //    - si no existe o no es propio -> error CONSULTA_NO_DISPONIBLE
  //    - si no hay consulta guardada -> mismo error
  // 6. Generar relativePath = `storage/adjuntos/consulta/${turnoId}/${crypto.randomUUID()}${ext}`
  // 7. mkdir recursive del directorio padre
  // 8. writeFile(relativePath absoluto, buffer)
  //    - si falla -> error ADJUNTO_ERROR_GUARDADO
  // 9. prisma.$transaction:
  //    a) adjunto.create({ consultaTurnoId, nombre, rutaPrivada, mimeType, tamanoBytes, creadoEn })
  //    b) auditoria.create({ actorId, accion: AUDITORIA.REGISTRO_ADJUNTO_CONSULTA, entidad: "adjunto", referenciaId: turnoId })
  //    - si falla -> unlink archivo y error ADJUNTO_ERROR_GUARDADO
  // 10. revalidatePath(`/medico/turnos/${turnoId}`)
  // 11. return { exito: true, adjuntoId, mensaje: MSG.ADJUNTO_EXITO }
}
```

### 7.3 Route Handler médico (`src/app/api/medico/consultas/[turnoId]/adjuntos/[adjuntoId]/archivo/route.ts`)

```ts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ turnoId: string; adjuntoId: string }> },
): Promise<Response> {
  // 1. sesion = await getSession(); si no hay o rol !== MEDICO -> 401
  // 2. validar turnoId y adjuntoId (BigInt)
  // 3. adjunto = prisma.adjunto.findUnique({ where: { id }, include: { consulta: { include: { turno: { include: { disponibilidad: true } } } } } })
  // 4. si no existe o consulta.autorId !== sesion.usuarioId o disponibilidad.profesionalId !== sesion.usuarioId -> 404
  // 5. leer archivo desde ruta privada (absoluta o relativa a cwd)
  // 6. download = new URL(request.url).searchParams.get("download") === "1"
  // 7. Content-Disposition: download ? `attachment; filename="${nombreSeguro}${ext}"` : `inline; filename="${nombreSeguro}${ext}"`
  // 8. Content-Type = adjunto.mimeType; Cache-Control: private, no-store
  // 9. devolver Response con el buffer
}
```

### 7.4 Route Handler paciente (`src/app/api/paciente/turnos/[turnoId]/adjuntos/[adjuntoId]/archivo/route.ts`)

```ts
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ turnoId: string; adjuntoId: string }> },
): Promise<Response> {
  // 1. sesion = await getSession(); si no hay o rol !== PACIENTE -> 401
  // 2. beneficiarios = cargarBeneficiarios(BigInt(sesion.usuarioId))
  // 3. turno = prisma.turno.findUnique({ where: { id: turnoId }, select: { pacienteId: true, consulta: { select: { adjuntos: ... } } } })
  // 4. si turno no existe o pacienteId no está en beneficiarios -> 404
  // 5. adjunto = turno.consulta?.adjuntos.find(a => a.id === adjuntoId); si no -> 404
  // 6. leer archivo
  // 7. Content-Disposition: inline (siempre, ignorar ?download)
  // 8. Content-Type = adjunto.mimeType; Cache-Control: private, no-store
}
```

### 7.5 Integración en `consulta-detalle-view.tsx`

- Nuevo prop `adjuntos: AdjuntoClinicoViewData[]` y `turnoId: string`.
- Sección "Documentación adjunta":
  - Si hay adjuntos: lista con nombre descriptivo, tamaño formateado, fecha de incorporación ("Adjuntado el …"), enlaces "Ver archivo" y (solo médico) "Descargar".
  - Si no hay: mensaje "Esta consulta no tiene documentos adjuntos."
- Formulario `adjuntar-documento-form.tsx` (solo médico) debajo de la lista, con campos:
  - `turnoId` (hidden)
  - `nombre` (text, required, maxLength 255)
  - `archivo` (file, required, accept=".pdf,.jpg,.jpeg,.png")
  - botón "Adjuntar documento" con estado de carga.
- Los enlaces de visualización apuntan al Route Handler médico con `target="_blank"` y `rel="noopener noreferrer"`.

### 7.6 Integración en paciente (`src/app/(app)/paciente/turnos/[id]/page.tsx`)

- Cargar adjuntos mediante `obtenerAdjuntosConsultaPaciente` cuando la cita esté atendida (o siempre que exista consulta).
- Sección "Documentación adjunta" con lista de nombres y enlaces "Ver archivo" al Route Handler paciente (sin botón de descarga).
- Para imágenes, opcionalmente mostrar miniatura `<img>` apuntando al endpoint; para PDF, solo enlace.
- Sin formulario de carga.

---

## 8. Cómo testear el flujo

### 8.1 Verificación automatizada previa

```bash
npm run format
npm run lint
npm run format:check
npm run build
```

### 8.2 Checklist de pruebas manuales (E2E)

Credenciales: `medico@sigsam.local` / `Medico@1234`, `admin@sigsam.local` / `Admin@1234`, `paciente@sigsam.local` / `Paciente@1234`.

#### Escenario 1: Adjunto exitoso (CA1, CA2, CA3)
1. Como médico, abrir una cita propia ya atendida con consulta guardada (ej. `/medico/turnos/2`).
2. En "Documentación adjunta", completar "Nombre descriptivo" y seleccionar un PDF ≤ 10 MB.
3. Clic en "Adjuntar documento".
4. **Esperado:** mensaje "Documento adjuntado con éxito."; el archivo aparece en la lista con fecha de incorporación; `consulta.creada_en` no cambia; existe fila en `adjunto` y archivo en `storage/adjuntos/...`; auditoría registrada.

#### Escenario 2: Validaciones de tipo y tamaño (CA2)
1. Intentar adjuntar un `.docx`, un `.txt` y un archivo > 10 MB.
2. **Esperado:** mensajes "Solo se permiten archivos PDF, JPG o PNG." / "El archivo supera los 10 MB permitidos."; no se crea fila ni archivo.

#### Escenario 3: Nombre descriptivo obligatorio (CA1)
1. Seleccionar archivo válido dejando el nombre vacío.
2. **Esperado:** "El nombre descriptivo del archivo es obligatorio."; no se guarda nada.

#### Escenario 4: Carga fallida no crea adjunto incompleto (CA2)
1. Simular error de escritura (permisos) o interrumpir la carga.
2. **Esperado:** no queda fila en `adjunto` ni archivo parcial; se muestra "No se pudo guardar el archivo. Intentá nuevamente."

#### Escenario 5: Inmutabilidad (CA5)
1. Con adjuntos guardados, recargar la ficha.
2. **Esperado:** no hay botones de editar ni eliminar; solo "Ver archivo"/"Descargar".

#### Escenario 6: Descarga del autor (CA4)
1. Como médico autor, clic en "Descargar".
2. **Esperado:** el navegador descarga el archivo con el nombre descriptivo + extensión.

#### Escenario 7: Visualización del paciente/tutor (CA4)
1. Como `paciente@sigsam.local`, abrir la cita correspondiente.
2. **Esperado:** sección "Documentación adjunta" con enlaces "Ver archivo"; el archivo se abre en el navegador; no hay botón "Descargar" ni formulario de carga.

#### Escenario 8: Sin descarga clínica desde el portal (CA4)
1. Inspeccionar la página del paciente.
2. **Esperado:** no existe control de descarga ni atributo `download` en los enlaces; el Route Handler paciente devuelve `Content-Disposition: inline`.

#### Escenario 9: Confidencialidad (CA5)
1. Como otro médico, intentar `/medico/turnos/<id>` de la cita ajena.
2. Como `admin@sigsam.local`, intentar el endpoint médico.
3. Como paciente ajeno, intentar el endpoint paciente.
4. **Esperado:** 404/401 o redirección a `/sin-permiso`; sin filtrar existencia.

#### Escenario 10: Incorporación posterior no cambia la atención (CA3)
1. Adjuntar un segundo archivo días después.
2. **Esperado:** aparece como nuevo ítem con su propia fecha; `consulta.creada_en` permanece igual.

---

## 9. Registro de decisiones arquitectónicas (propuesta)

Se propone incorporar en `docs/DECISIONES.md`:

### D-22 — Adjuntos de consulta en filesystem privado e inmutables
- **Estado:** Propuesta
- **Decisión:** Los adjuntos de consulta (US-SIG-019) se almacenan en el **filesystem privado del servidor** (`storage/adjuntos/consulta/<turnoId>/<uuid>.<ext>`), fuera de `public/`, con la ruta relativa en `adjunto.ruta_privada`. El nombre descriptivo del usuario se persiste en `adjunto.nombre` y no participa del path. Se admiten únicamente PDF/JPG/PNG de hasta 10 MB, validados por MIME, extensión y firma mágica antes de persistir. La carga es exclusiva del médico autor de la consulta; el archivo se sirve mediante Route Handlers con autorización (descarga para el autor, visualización en línea para paciente/tutor vigente, sin descarga clínica). Los adjuntos no se editan ni eliminan; los errores se aclaran con correcciones y archivos adicionales. El modelo `Adjunto` existente no requiere migración.
- **Motivo:** Cumplimiento de CA1 a CA5 de US-SIG-019, D-02 (sin Supabase Storage) y preservación del secreto clínico.

---

## 10. Notas de implementación

- Agregar `storage/` a `.gitignore` para no versionar archivos clínicos.
- Formatear tamaños en la UI (bytes → KB/MB) con helper local; no instalar librerías.
- Para evitar condiciones de carrera, generar el nombre físico con `crypto.randomUUID()` (Node built-in).
- Mantener `Cache-Control: private, no-store` en ambos Route Handlers.
- Si en el futuro se implementa US-SIG-020 (historial), reutilizar `obtenerAdjuntosConsultaPaciente` y el endpoint paciente definidos aquí.