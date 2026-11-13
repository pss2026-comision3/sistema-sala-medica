# Plan de implementación — US-SIG-020 Consultar el historial del paciente representado

Este documento especifica la arquitectura, diseño, reglas de negocio y estrategia de pruebas para implementar la historia de usuario **US-SIG-020** en SIGSAM. Sigue estrictamente las convenciones de `docs/DECISIONES.md` y los estándares de `docs/PLAN-US-017.md`, `docs/PLAN-US-018.md` y `docs/PLAN-US-019.md`.

> **Estado:** Plan propuesto.  
> **Rama de trabajo:** `feature/us-020-consultar-historial` (creada a partir de `stage` actualizado).  
> **Módulo:** Historia Clínica (`RF-04`, `RF-16`).  
> **Sprint:** 2.

---

## 0. Qué hacer y qué no hacer

### Qué hacer:
1. **Acceso exclusivo para rol PACIENTE:** Un usuario autenticado con rol `PACIENTE` accede a su historia clínica desde la ruta `/paciente/historial`.
2. **Autorización y representación (CA1):**
   - El titular accede únicamente a su propia ficha médica.
   - El tutor accede a las fichas de los menores de 18 años con vínculo vigente (`tutorId === usuario.personaId` y `fechaNacimiento > limiteAdultez`).
   - Se verifica la autorización en el servidor en **cada consulta**, impidiendo el acceso a identificadores manipulados por URL o marcadores guardados (prevención estricta de IDOR / *broken object level authorization*).
   - Si el usuario representa a menores tutelados, la interfaz provee un selector de beneficiario para alternar entre el titular y los menores a cargo.
3. **Ordenamiento e identificación de consultas (CA2):**
   - Las consultas médicas se ordenan cronológicamente en forma descendente (de la más reciente a la más antigua).
   - Cada consulta identifica claramente: fecha y hora de la atención, nombre completo del profesional médico y nombre de la especialidad.
4. **Filtros de consultas (CA2):**
   - Filtro por **período**: fechas `desde` y `hasta` con validación de rango coherente (`desde <= hasta`).
   - Filtro por **especialidad**: listado desplegable de especialidades atendidas o disponibles.
   - Los filtros persisten mediante parámetros de búsqueda en la URL (`searchParams`), asegurando compatibilidad con navegación directa y manteniendo la validación de permisos del CA1.
5. **Detalle completo en solo lectura (CA3):**
   - Muestra el registro clínico original de la consulta: diagnóstico (obligatorio), síntomas, indicaciones, medicación, estudios solicitados, observaciones y certificados emitidos.
   - Muestra cronológicamente las **correcciones** agregadas por el profesional: fecha/hora de emisión, autor, motivo y texto de la aclaración.
   - Muestra los **adjuntos** clínicos asociados: nombre descriptivo, fecha de incorporación, formato (PDF/JPG/PNG), tamaño formateado y visualización previa o enlace de apertura en línea ("Ver archivo").
   - La vista es **estrictamente de solo lectura**: el paciente y tutor no pueden modificar notas, ni editar campos, ni cargar archivos.
6. **Sección separada de vacunación (CA4):**
   - Las vacunas aplicadas se presentan en una sección o pestaña visualmente separada de las consultas médicas.
   - Cada aplicación identifica: fecha y hora, nombre de la vacuna, dosis/lote y personal de enfermería responsable del registro.
   - Se excluyen taxativamente movimientos de compras (`COMPRA`) y ajustes de stock (`AJUSTE`).
   - Se provee estado vacío informativo para pacientes sin vacunas aplicadas.
7. **Prohibición de exportación y descarga clínica (CA5):**
   - El portal **no** ofrece botones ni funciones de "Exportar a PDF", "Exportar a Excel" o impresión de la historia clínica.
   - Los adjuntos clínicos **no** tienen opción ni atributo de descarga (`download` o `Content-Disposition: attachment`); solo se ofrece visualización en línea (`Content-Disposition: inline`) a través del Route Handler seguro de paciente (`/api/paciente/turnos/[id]/adjuntos/[adjuntoId]/archivo`).
   - La documentación administrativa (facturas y comprobantes de turnos) permanece en su módulo administrativo propio (`/paciente/turnos`), sin mezclarse con la historia clínica.
8. **Navegación:**
   - Incorporar "Mi historia" en el menú de navegación para pacientes en `src/components/app-shell.tsx`.
   - Activar el acceso rápido a "Mi historia clínica" desde el panel de inicio del paciente (`src/app/(app)/paciente/page.tsx`).

### Qué no hacer:
- **No** permitir que un paciente consulte la historia clínica de otro adulto, ni de un menor sobre el que no tenga tutela activa.
- **No** permitir acceso si el menor cumplió 18 años (vínculo de tutor cesado por mayoría de edad).
- **No** permitir que el Administrador ni Enfermería accedan a las notas de consulta médica (`ADMIN` y `ENFERMERIA` no tienen acceso clínico por D-07 y RF-04).
- **No** permitir que un médico consulte notas clínicas de otros médicos desde esta pantalla (los médicos gestionan sus consultas en `/medico/turnos/[id]`).
- **No** incluir botones de edición, eliminación o carga de notas ni archivos en la interfaz del paciente.
- **No** incluir botones de exportación masiva ni de descarga clínica.
- **No** modificar el esquema relacional (`prisma/schema.prisma` ya dispone de `Consulta`, `Correccion`, `Adjunto`, `Turno`, `MovimientoStock`, `LoteVacuna`, `Vacuna`, `Paciente`).
- **No** instalar dependencias adicionales.

---

## 1. Criterios de Aceptación (US-SIG-020)

> **Como** paciente o tutor,  
> **quiero** visualizar las consultas y vacunaciones del paciente que represento,  
> **para** revisar las indicaciones y antecedentes de atención.
>
> **Preguntas relacionadas:** P-09, P-10, P-11, P-40, P-51, P-52, P-54, P-55, P-60, P-64.

- **CA1.** El titular accede únicamente a su ficha y el tutor a las fichas de menores con vínculo vigente. Se verifica el permiso cada vez que se consulta, incluso mediante una dirección guardada.  
- **CA2.** Las consultas se ordenan por fecha e identifican al médico y especialidad. Se puede filtrar por período y especialidad.  
- **CA3.** El detalle muestra el registro original, sus correcciones y los adjuntos visualizables. El paciente no modifica notas ni agrega archivos.  
- **CA4.** Las vacunas aplicadas se presentan en una sección separada con fecha, vacuna, dosis y personal responsable; no se incluyen movimientos de compras o ajustes de inventario.  
- **CA5.** El portal no ofrece exportar la historia clínica ni descargar adjuntos clínicos. La solicitud presencial al médico queda fuera de este flujo; la factura se trata como documentación administrativa.

**Inferencias:** la prohibición de descargar se interpreta como ausencia de esa función en el portal, manteniendo la visualización. El tutor dispone de la misma consulta mientras conserve su vínculo.

---

## 2. Dependencias y estado del sistema

1. **Autenticación y Representación (US-001, US-002, US-003):**
   - `getSession()` y `requireRole("PACIENTE")` validan la sesión activa del usuario.
   - `cargarBeneficiarios(usuarioId)` en `src/lib/turnos/buscar-horarios.ts` ya resuelve al titular adulto y a todos los menores de 18 años con vínculo de tutor activo.
2. **Consultas Médicas (US-017):**
   - El modelo `Consulta` en PostgreSQL está vinculado a `Turno` (`turnoId`), con autor `Medico` (`autorId`), `diagnostico`, `sintomas`, `indicaciones`, `medicacion`, `estudios`, `observaciones`, `certificado` y `creadaEn`.
3. **Correcciones Clínicas (US-018):**
   - El modelo `Correccion` almacena aclaraciones inmutables (`texto`, `motivo`, `autorId`, `creadaEn`, `consultaTurnoId`).
4. **Adjuntos de Consulta (US-019):**
   - El modelo `Adjunto` almacena metadatos y ruta privada del archivo en el servidor.
   - El Route Handler `GET /api/paciente/turnos/[id]/adjuntos/[adjuntoId]/archivo` ya está implementado y sirve los archivos con cabecera `Content-Disposition: inline` y `Cache-Control: private, no-store`.
5. **Vacunación aplicada (US-025 - Sprint 3):**
   - Aunque la pantalla operativa de enfermería para registrar la aplicación se completa en el Sprint 3, el modelo de datos `MovimientoStock` ya cuenta con el enum `tipo = 'APLICACION'`, `turnoId`, `loteId` y `registradoPor`.
   - La consulta para US-020 lee directamente de la base de datos `MovimientoStock` con `tipo: 'APLICACION'`, garantizando que cuando Enfermería registre aplicaciones en Sprint 3, aparecerán automáticamente sin tocar la consulta. En Sprint 2 muestra las aplicaciones sembradas en seed o un estado vacío limpio.

---

## 3. Decisiones de diseño y arquitectura

| Tema | Decisión técnica | Justificación |
| --- | --- | --- |
| **Ubicación de la pantalla** | `/paciente/historial` (Server Component) con vistas client en `/paciente/historial/historial-view.tsx`. | Cumple con el wireframe SC-08 (`nav: 'Mi historia'`) y centraliza la historia clínica del paciente y sus representados. |
| **Selector de beneficiario** | Desplegable o píldoras con el Titular y los menores tutelados activos obtenidos mediante `cargarBeneficiarios()`. | Permite alternar fácilmente la ficha médica entre el usuario y sus hijos o tutelados. |
| **Verificación de permisos (CA1)** | En cada request al Server Component se comprueba si el `pacienteId` solicitado pertenece a los beneficiarios autorizados. Si no pertenece, se responde con `notFound()`. | Impide IDOR (*Insecure Direct Object Reference*), consultas cruzadas y accesos tras revocación de tutela o cumplimiento de mayoría de edad. |
| **Filtros en URL (`searchParams`)** | `?beneficiario=<id>&desde=<YYYY-MM-DD>&hasta=<YYYY-MM-DD>&especialidad=<id>&seccion=<consultas\|vacunas>`. | Permite compartir enlaces autorizados, recargar la página y volver atrás en el navegador sin perder el estado del filtro. |
| **Orden cronológico (CA2)** | Orden `desc` por fecha de la cita (`turno.disponibilidad.fecha desc, turno.hora desc`). | Los antecedentes más recientes deben verse primero para evaluar la continuidad de la atención. |
| **Detalle de consulta (CA3)** | Tarjeta colapsable/expandible por cada consulta con badges claros para diagnóstico, indicaciones, correcciones anexadas y visor de adjuntos. | Permite una lectura ágil del resumen y profundizar en los detalles sin saturar la pantalla. |
| **Sección separada de vacunas (CA4)** | Pestañas visuales accesibles: "Consultas médicas" y "Vacunas aplicadas". | Diferencia las atenciones por especialidad médica de las dosis recibidas en el vacunatorio. |
| **Filtro de vacunas (CA4)** | Consulta SQL/Prisma: `movimiento_stock.tipo = 'APLICACION'` asociado al paciente. | Excluye explícitamente `COMPRA` y `AJUSTE`, cumpliendo estrictamente con el CA4. |
| **Prohibición de descargas/exportación (CA5)** | Enlaces "Ver archivo" que abren en nueva pestaña (`inline`); sin botón "Descargar", sin atributo `download`, sin endpoints de descarga clínica. Sin botones de exportación a PDF ni Excel. | Cumplimiento estricto del CA5 y de las decisiones del Enunciado (la descarga solo la realiza el médico o presencialmente). |
| **Sin mutaciones (CA3)** | Esta vista no contiene Server Actions ni formularios de edición/creación para el paciente. | La historia clínica del paciente es de solo lectura. |

---

## 4. Mensajes exactos (español)

| Clave / Contexto | Mensaje literal |
| --- | --- |
| **Título de página** | Historia clínica |
| **Subtítulo de página** | Información de tus atenciones y de las personas menores que representás. Esta vista es de solo lectura. |
| **Aviso de solo lectura** | Las consultas médicas y aplicaciones de vacunas son registradas por los profesionales de la sala; el contenido original y sus correcciones se conservan de forma inmutable. |
| **Pestaña Consultas** | Consultas médicas |
| **Pestaña Vacunas** | Vacunas aplicadas |
| **Selector de beneficiario** | Paciente representado |
| **Filtro Desde** | Desde |
| **Filtro Hasta** | Hasta |
| **Filtro Especialidad** | Especialidad |
| **Todas las especialidades** | Todas las especialidades |
| **Botón filtrar** | Aplicar filtros |
| **Botón limpiar filtros** | Limpiar filtros |
| **Error rango de fechas** | La fecha «Desde» no puede ser posterior a la fecha «Hasta». |
| **Sin consultas (historial vacío)** | Aún no hay consultas registradas para este paciente. |
| **Sin consultas (filtro sin resultados)** | No se encontraron consultas para los filtros seleccionados. |
| **Sin vacunas aplicadas** | No hay vacunas aplicadas registradas para este paciente. |
| **Etiqueta diagnóstico** | Diagnóstico |
| **Etiqueta síntomas** | Síntomas |
| **Etiqueta indicaciones** | Indicaciones |
| **Etiqueta medicación** | Medicación |
| **Etiqueta estudios** | Estudios solicitados |
| **Etiqueta observaciones** | Observaciones |
| **Etiqueta certificado** | Certificado emitido |
| **Título correcciones** | Correcciones anexadas |
| **Prefijo corrección** | Corrección realizada el |
| **Motivo corrección** | Motivo: |
| **Título adjuntos** | Documentación adjunta |
| **Enlace ver adjunto** | Ver archivo |
| **Sin adjuntos** | Sin documentos adjuntos. |
| **Cabecera vacuna** | Vacuna |
| **Cabecera dosis / lote** | Dosis / Lote |
| **Cabecera responsable** | Aplicada por |
| **Cabecera fecha aplicación** | Fecha de aplicación |

---

## 5. Rutas y navegación

| Ruta | Rol / Permiso | Propósito |
| --- | --- | --- |
| `/paciente/historial` | `PACIENTE` (titular o tutor activo) | Pantalla principal de la historia clínica. Muestra el historial del titular o del paciente representado según `?beneficiario=<id>`. |
| `/paciente/historial?seccion=vacunas` | `PACIENTE` | Pestaña de vacunas aplicadas del beneficiario seleccionado. |
| `/api/paciente/turnos/[id]/adjuntos/[adjuntoId]/archivo` | `PACIENTE` (titular o tutor activo) | Route Handler ya implementado en US-019. Sirve el archivo para visualización en línea (`inline`). |
| `/sin-permiso` | Otros roles (`ADMIN`, `MEDICO`, `ENFERMERIA`) | Redirección estándar de acceso denegado si se intenta acceder a rutas no autorizadas. |

---

## 6. Árbol de archivos a crear y modificar

```text
sistema-sala-medica/
├── docs/
│   ├── PLAN-US-020.md                                     [NUEVO] Plan maestro de implementación
│   └── Plan de Demo - Sprint 2.md                         [MODIFICAR] Guión de prueba para la demo de US-020
├── src/
│   ├── app/
│   │   └── (app)/
│   │       └── paciente/
│   │           ├── historial/
│   │           │   ├── page.tsx                           [NUEVO] Server Component principal de historia clínica
│   │           │   └── historial-view.tsx                 [NUEVO] Client Component de filtros, pestañas y vista
│   │           └── page.tsx                               [MODIFICAR] Vincular tarjeta de acceso rápido a /paciente/historial
│   ├── components/
│   │   ├── app-shell.tsx                                  [MODIFICAR] Agregar 'Mi historia' a navegación PACIENTE
│   │   └── paciente/
│   │       └── historial/
│   │           ├── consulta-historial-card.tsx            [NUEVO] Detalle expandible de consulta, correcciones y adjuntos
│   │           ├── vacunas-historial-table.tsx            [NUEVO] Tabla/lista de vacunas aplicadas (CA4)
│   │           └── filtros-historial-bar.tsx              [NUEVO] Barra interactiva de filtros de período y especialidad
│   └── lib/
│       └── turnos/
│           └── historial-clinico.ts                       [NUEVO] Consultas Prisma, autorización y tipos de datos
```

---

## 7. Modelo de datos y consultas Prisma

### 7.1 Tipos de datos para la capa de presentación

```typescript
export interface CorreccionHistorialItem {
  id: string;
  motivo: string;
  texto: string;
  creadaEn: string; // ISO
  autorNombre: string;
}

export interface AdjuntoHistorialItem {
  id: string;
  nombre: string;
  mimeType: string;
  tamanoBytes: number;
  creadoEn: string; // ISO
  urlVisualizacion: string;
}

export interface ConsultaHistorialItem {
  turnoId: string;
  fecha: string; // YYYY-MM-DD
  hora: string;  // HH:mm
  medicoNombre: string;
  especialidadNombre: string;
  diagnostico: string;
  sintomas: string | null;
  indicaciones: string | null;
  medicacion: string | null;
  estudios: string | null;
  observaciones: string | null;
  certificado: string | null;
  creadaEn: string; // ISO
  correcciones: CorreccionHistorialItem[];
  adjuntos: AdjuntoHistorialItem[];
}

export interface VacunaAplicadaItem {
  id: string;
  fecha: string; // YYYY-MM-DD
  hora?: string;
  vacunaNombre: string;
  dosisOLote: string;
  responsableNombre: string;
}

export interface FiltrosHistorial {
  beneficiarioId: string;
  desde?: string; // YYYY-MM-DD
  hasta?: string; // YYYY-MM-DD
  especialidadId?: string;
}
```

### 7.2 Lógica de consulta de consultas médicas (Prisma)

```typescript
export async function obtenerConsultasHistorialPaciente(
  filtros: FiltrosHistorial
): Promise<ConsultaHistorialItem[]> {
  const pacienteIdBig = BigInt(filtros.beneficiarioId);

  // Cláusulas where dinámicas para período
  const whereTurno: any = {
    pacienteId: pacienteIdBig,
    estado: "CONFIRMADO",
    resultado: "ATENDIDO",
    consulta: { isNot: null },
  };

  if (filtros.especialidadId) {
    const espId = BigInt(filtros.especialidadId);
    whereTurno.disponibilidad = {
      profesional: {
        medico: { especialidadId: espId },
      },
    };
  }

  if (filtros.desde || filtros.hasta) {
    whereTurno.disponibilidad = {
      ...whereTurno.disponibilidad,
      fecha: {
        ...(filtros.desde ? { gte: new Date(`${filtros.desde}T00:00:00Z`) } : {}),
        ...(filtros.hasta ? { lte: new Date(`${filtros.hasta}T23:59:59Z`) } : {}),
      },
    };
  }

  const turnos = await prisma.turno.findMany({
    where: whereTurno,
    orderBy: [
      { disponibilidad: { fecha: "desc" } },
      { hora: "desc" },
    ],
    include: {
      disponibilidad: {
        include: {
          profesional: {
            include: {
              persona: true,
              medico: { include: { especialidad: true } },
            },
          },
        },
      },
      consulta: {
        include: {
          correcciones: {
            orderBy: { creadaEn: "asc" },
            include: { autor: { include: { usuario: { include: { persona: true } } } } },
          },
          adjuntos: {
            orderBy: { creadoEn: "asc" },
          },
        },
      },
    },
  });

  return turnos
    .filter((t) => t.consulta !== null)
    .map((t) => {
      const c = t.consulta!;
      const fechaStr = t.disponibilidad.fecha.toISOString().slice(0, 10);
      const horaStr = t.hora.toISOString().slice(11, 16);
      const medicoNombre = t.disponibilidad.profesional.persona.nombreCompleto;
      const especialidadNombre =
        t.disponibilidad.profesional.medico?.especialidad?.nombre ?? "Medicina general";

      return {
        turnoId: t.id.toString(),
        fecha: fechaStr,
        hora: horaStr,
        medicoNombre,
        especialidadNombre,
        diagnostico: c.diagnostico,
        sintomas: c.sintomas,
        indicaciones: c.indicaciones,
        medicacion: c.medicacion,
        estudios: c.estudios,
        observaciones: c.observaciones,
        certificado: c.certificado,
        creadaEn: c.creadaEn.toISOString(),
        correcciones: c.correcciones.map((corr) => ({
          id: corr.id.toString(),
          motivo: corr.motivo,
          texto: corr.texto,
          creadaEn: corr.creadaEn.toISOString(),
          autorNombre: corr.autor.usuario.persona.nombreCompleto,
        })),
        adjuntos: c.adjuntos.map((adj) => ({
          id: adj.id.toString(),
          nombre: adj.nombre,
          mimeType: adj.mimeType,
          tamanoBytes: Number(adj.tamanoBytes),
          creadoEn: adj.creadoEn.toISOString(),
          urlVisualizacion: `/api/paciente/turnos/${t.id.toString()}/adjuntos/${adj.id.toString()}/archivo`,
        })),
      };
    });
}
```

### 7.3 Lógica de consulta de vacunas aplicadas (Prisma)

```typescript
export async function obtenerVacunasAplicadasPaciente(
  pacienteId: string
): Promise<VacunaAplicadaItem[]> {
  const pacienteIdBig = BigInt(pacienteId);

  // CA4: Movimientos de stock de tipo APLICACION asociados a turnos del paciente
  const movimientos = await prisma.movimientoStock.findMany({
    where: {
      tipo: "APLICACION",
      turno: {
        pacienteId: pacienteIdBig,
        tipo: "VACUNACION",
        resultado: "ATENDIDO",
      },
    },
    orderBy: { creadoEn: "desc" },
    include: {
      lote: {
        include: { vacuna: true },
      },
      registrador: {
        include: { persona: true },
      },
      turno: {
        include: { disponibilidad: true },
      },
    },
  });

  return movimientos.map((m) => {
    const fecha = m.turno?.disponibilidad
      ? m.turno.disponibilidad.fecha.toISOString().slice(0, 10)
      : m.creadoEn.toISOString().slice(0, 10);
    const hora = m.turno ? m.turno.hora.toISOString().slice(11, 16) : undefined;

    return {
      id: m.id.toString(),
      fecha,
      hora,
      vacunaNombre: m.lote.vacuna.nombre,
      dosisOLote: m.lote.codigo,
      responsableNombre: m.registrador.persona.nombreCompleto,
    };
  });
}
```

---

## 8. Reglas de negocio y flujos de autorización

### CA1: Verificación estricta de beneficiario (Anti-IDOR)
1. Extraer la sesión con `requireRole("PACIENTE")`.
2. Ejecutar `const beneficiarios = await cargarBeneficiarios(BigInt(sesion.usuarioId));`.
   - Incluye al paciente titular adulto (`usuario.personaId`).
   - Incluye únicamente a los menores donde `tutorId === usuario.personaId` y `esMenor(fechaNacimiento)`.
3. Obtener `beneficiarioId` desde `searchParams`:
   - Si no viene o está vacío, seleccionar por defecto el titular (`beneficiarios[0].id`).
   - Si viene un `beneficiarioId` en la URL:
     - Comprobar si `beneficiarios.some(b => b.id === beneficiarioId)`.
     - Si **no** coincide con ningún beneficiario autorizado: abortar inmediatamente invocando `notFound()` o mostrando mensaje de permiso denegado. Nunca exponer registros de otros pacientes.

### CA2: Ordenamiento y filtrado
1. Las consultas se ordenan con `orderBy: [{ disponibilidad: { fecha: "desc" } }, { hora: "desc" }]`.
2. Si se suministran `desde` y/o `hasta`:
   - Validar sintaxis ISO `YYYY-MM-DD`.
   - Si ambos están presentes, verificar que `desde <= hasta`. Si `desde > hasta`, mostrar aviso claro al usuario en la barra de filtros y no disparar consulta incongruente.
3. El filtro de especialidad lista las especialidades con las que el paciente cuenta con antecedentes (o todas las especialidades disponibles).

### CA3: Integridad de notas clínicas, correcciones y adjuntos
1. El detalle de cada consulta despliega todos los campos clínicos no nulos registrados por el médico.
2. Si existen correcciones (`correcciones.length > 0`), se muestran en un panel claramente identificado como "Correcciones posteriores", con su motivo, autor y fecha exacta.
3. Si existen adjuntos (`adjuntos.length > 0`), se visualizan con su nombre, tamaño y fecha. Los formatos de imagen (PNG/JPG) pueden desplegar miniatura; todos cuentan con el enlace "Ver archivo" que invoca el Route Handler seguro con `Content-Disposition: inline`.
4. En ningún punto de la interfaz existen botones `Editar`, `Borrar`, `Agregar corrección` ni formularios de carga para el paciente.

### CA4: Sección de vacunas aplicadas y exclusión de movimientos operativos
1. En la pestaña "Vacunas aplicadas", se listan exclusivamente registros con `tipo: "APLICACION"`.
2. Los movimientos de stock de tipo `COMPRA` y `AJUSTE` se omiten automáticamente en el filtro `where`.
3. Cada fila muestra: Fecha, Vacuna, Lote / Dosis y Personal responsable (Enfermería).
4. Si no hay vacunas aplicadas, se renderiza el componente de estado vacío sin errores.

### CA5: Prohibición de exportar y descargar
1. En ningún lugar de la vista existe botón "Exportar historia clínica" ni "Descargar PDF".
2. Los enlaces a los adjuntos apuntan al Route Handler `/api/paciente/turnos/[id]/adjuntos/[adjuntoId]/archivo`, el cual utiliza cabeceras `Content-Disposition: inline` y `Cache-Control: private, no-store`.
3. No se utiliza el atributo `download` en los enlaces HTML.

---

## 9. Diseño de componentes de interfaz (UI/UX)

Siguiendo el sistema de diseño de SIGSAM (`src/app/globals.css`, Tailwind v4):

1. **`HistorialView` (`historial-view.tsx`):**
   - Encabezado con selector de paciente (titular / hijos representados).
   - Selector de pestañas ("Consultas médicas" y "Vacunas aplicadas") con conteo de registros en badges.
   - Barra de filtros accesible con campos `desde`, `hasta` y desplegable de `especialidad`.
2. **`ConsultaHistorialCard` (`consulta-historial-card.tsx`):**
   - Cabecera: Fecha, hora, nombre del médico y píldora con el nombre de la especialidad.
   - Bloque principal: Diagnóstico destacado en negrita.
   - Bloques secundarios: Indicaciones, Medicación, Síntomas, Estudios, Observaciones, Certificados (solo se muestran si tienen contenido).
   - Bloque de correcciones: Tarjeta con borde sutil indicando fecha, autor, motivo y texto correctivo.
   - Bloque de documentación adjunta: Tarjeta con lista de archivos, peso formateado (ej. `1.2 MB`), miniatura en imágenes y enlace "Ver archivo".
3. **`VacunasHistorialTable` (`vacunas-historial-table.tsx`):**
   - Tabla responsiva con columnas: Fecha, Vacuna, Dosis / Lote, Profesional responsable.
4. **Estados vacíos:**
   - Card informativa con icono `sigsam-notice info` cuando no hay historial registrado.

---

## 10. Estrategia de pruebas y verificación

### 10.1 Casos de prueba funcionales
- **CP-01 (Titular accede a su propia historia):**
  - Iniciar sesión con paciente titular adulto.
  - Navegar a `/paciente/historial`.
  - Verificar que se listan sus consultas médicas con diagnóstico, médico y especialidad.
- **CP-02 (Tutor consulta ficha de menor representado):**
  - Iniciar sesión con tutor de un menor.
  - Seleccionar al menor en el desplegable de beneficiario.
  - Verificar que la URL actualiza `?beneficiario=<idMenor>` y se muestran las consultas y vacunas del menor.
- **CP-03 (Protección IDOR / URL manipulada):**
  - Con sesión de paciente A, ingresar manualmente en la barra de direcciones `?beneficiario=<idPacienteB>`.
  - Verificar que el sistema responde con `404 Not Found` (o redirección a `/sin-permiso`), sin revelar datos de B.
- **CP-04 (Menor emancipado / mayoría de edad cumplida):**
  - Con un paciente que cumplió 18 años, verificar que ya no figura en la lista de tutelados del tutor y que el acceso directo con su ID es denegado.
- **CP-05 (Orden cronológico de consultas):**
  - Verificar que las consultas médicas se ordenan de la fecha más reciente a la más antigua.
- **CP-06 (Filtro por especialidad):**
  - Seleccionar una especialidad en el filtro y pulsar "Aplicar filtros".
  - Verificar que solo se muestran consultas de esa especialidad.
- **CP-07 (Filtro por período):**
  - Ingresar fechas `desde` y `hasta`.
  - Verificar que solo se muestran consultas dentro del rango.
  - Ingresar `desde > hasta` y comprobar que el sistema muestra el error "La fecha «Desde» no puede ser posterior a la fecha «Hasta»".
- **CP-08 (Visualización de correcciones y adjuntos):**
  - En una consulta con corrección, verificar que aparece el bloque de corrección con autor, motivo y texto.
  - En una consulta con archivo adjunto, hacer clic en "Ver archivo" y verificar que se visualiza en línea en el navegador sin descargarse al disco.
- **CP-09 (Solo lectura estricta):**
  - Verificar que no existan botones de edición, eliminación o formularios de carga.
- **CP-10 (Sección de vacunas aplicadas):**
  - Cambiar a la pestaña "Vacunas aplicadas".
  - Verificar que se muestra fecha, vacuna, dosis y enfermero responsable.
  - Verificar que movimientos de compra o ajustes no aparecen en esta lista.
- **CP-11 (Prohibición de exportar):**
  - Inspeccionar la interfaz y el código fuente asegurando que no existan opciones de exportación clínica ni descargas de adjuntos.

---

## 11. Guión para la Demo del Sprint 2

Para completar la sección correspondiente en `docs/Plan de Demo - Sprint 2.md`:

```markdown
## **US-SIG-020 - Consultar historial del paciente representado**

### Objetivo
Demostrar que un paciente adulto o tutor puede consultar la historia clínica completa de sí mismo y de sus representados menores en modo solo lectura, con filtros por especialidad y período, visualización de notas originales, correcciones y adjuntos, y sección diferenciada de vacunas aplicadas.

### Pasos de la demo:
1. Iniciar sesión como Paciente titular con consultas previas y tutelados a cargo.
2. Hacer clic en "Mi historia" desde la navegación principal.
3. Observar la ficha personal: consultas médicas ordenadas cronológicamente, indicando profesional, especialidad y diagnóstico.
4. Expandir una consulta para apreciar las notas completas, correcciones anexadas por el médico y la documentación adjunta.
5. Hacer clic en "Ver archivo" de un adjunto para evidenciar la visualización en línea (sin descarga clínica ni botón de exportar).
6. Aplicar filtros por período y especialidad para evidenciar la búsqueda acotada.
7. Cambiar el selector de paciente hacia el menor tutelado a cargo. Observar la actualización instantánea de la ficha clínica del menor.
8. Cambiar a la pestaña "Vacunas aplicadas" para mostrar las dosis aplicadas con vacuna, lote y personal de enfermería responsable.
9. Intentar modificar la URL con un ID de paciente no vinculado para demostrar el bloqueo de seguridad (404 / Sin permiso).
```

---

## 12. Matriz de trazabilidad

| Criterio de Aceptación | Componentes / Funciones | Pruebas |
| --- | --- | --- |
| **CA1 (Titular y tutor con vínculo vigente, sin IDOR)** | `historial-clinico.ts` (`verificarAccesoBeneficiario`, `cargarBeneficiarios`), `page.tsx` | CP-01, CP-02, CP-03, CP-04 |
| **CA2 (Orden cronológico, médico/especialidad, filtros)** | `historial-clinico.ts` (`obtenerConsultasHistorialPaciente`), `filtros-historial-bar.tsx` | CP-05, CP-06, CP-07 |
| **CA3 (Registro original, correcciones, adjuntos, solo lectura)** | `consulta-historial-card.tsx`, `historial-view.tsx` | CP-08, CP-09 |
| **CA4 (Vacunas aplicadas en sección separada, sin compras/ajustes)** | `vacunas-historial-table.tsx`, `historial-clinico.ts` (`obtenerVacunasAplicadasPaciente`) | CP-10 |
| **CA5 (Sin exportar ni descargar adjuntos)** | `consulta-historial-card.tsx`, Route Handler `GET .../archivo` (`inline`) | CP-08, CP-11 |
