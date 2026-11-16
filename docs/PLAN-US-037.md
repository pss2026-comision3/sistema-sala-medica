# US-SIG-037 — Consultar cobros y prestaciones con cobertura

**Responsable:** Agus · **Sprint:** 3 · **RF:** RF-20 · **Actor:** Administrador

> Como administrador, quiero revisar los cobros particulares y las coberturas
> registradas, para controlar ingresos simulados y prestaciones sin cobrar.

## Alcance implementado

Se agregó el reporte **"Prestaciones con cobertura"** (`cobros_cobertura`) al
módulo unificado de reportes (`/admin/reportes`), siguiendo la
_Guía para agregar nuevos reportes_.

| Archivo | Cambio |
| --- | --- |
| `src/lib/reportes/registry.ts` | Nuevo tipo `cobros_cobertura`, solo rol `ADMIN`. |
| `src/lib/reportes/tipos.ts` | Tipos de filtros y resultado del reporte. |
| `src/lib/reportes/cobros-cobertura.ts` | Servicio de consulta (`consultarReporteCobertura`) y opciones del filtro de obras sociales. |
| `src/app/actions/reportes.ts` | Server Action `obtenerReporteCoberturaAction` (exige `ADMIN`). |
| `src/app/(app)/admin/reportes/vista-cobertura.tsx` | Vista: KPIs, tabla por entidad, tabla por profesional y detalle paginado. |
| `src/app/(app)/admin/reportes/reportes-view.tsx` | Filtros (entidad, categoría, médico, especialidad) y render del reporte. |
| `src/app/(app)/admin/reportes/page.tsx` | Carga el catálogo de obras sociales para el filtro. |

### Reglas de negocio

- **Qué se cuenta:** turnos `CONFIRMADO` con resultado `ATENDIDO` (CA3).
- **Fecha del período:** la fecha de la cita (`disponibilidad.fecha`) (CA3).
- **Clasificación (CA3, recortada):**
  - Arancel `$0` → **Gratuita** (sin importar la modalidad).
  - Modalidad `CON_COBERTURA` → **Con cobertura registrada**.
  - Resto → **Particular** (sin estado de cobro; ver recortes).
- **Entidad de cobertura:** se muestra el nombre guardado en el turno al
  reservar (`cobertura_nombre_snapshot`), así una obra social renombrada no
  cambia el histórico. Filtrar por entidad muestra solo prestaciones con
  cobertura de esa entidad. El filtro incluye obras sociales inactivas.
- **Cobertura ≠ pago (CA4):** el reporte no suma importes como ingresos. El
  arancel aparece solo como referencia en el detalle, con un aviso explícito.
- **Permisos (CA5):** la Server Action exige `ADMIN` y el registro solo ofrece
  el reporte al Administrador (el Médico no lo ve en `/medico/reportes`).

## Criterios de aceptación

| CA | Estado | Detalle |
| --- | --- | --- |
| CA1 | ❌ Recortado | Toda la sección de cobros (intentos, importe, operador, prestación y factura) depende de US-029 y US-030, descartadas. |
| CA2 | ❌ Recortado | Total de ingresos simulados y separación aprobados/rechazados/cancelados: sin US-029 no hay intentos de pago. |
| CA3 | ⚠️ Parcial | Se filtra por fecha de cita y se muestran las atendidas como **Particular**, **Gratuita** o **Con cobertura registrada**. No se distingue "Particular cobrada / sin cobrar" (depende de US-029). |
| CA4 | ⚠️ Parcial | Filtros por entidad de cobertura, médico y especialidad. La cobertura no se contabiliza como pago. **No** hay filtro por vacuna (depende de US-023). |
| CA5 | ⚠️ Parcial | Solo el Administrador consulta el reporte agregado; el Paciente no tiene acceso. La consulta de comprobantes del Paciente depende de US-030. La exportación la agrega US-038. |

## CA no cumplidos por el recorte del Sprint 3

- **CA1 completo** — US-029 y US-030 descartadas.
- **CA2 completo** — US-029 descartada.
- **CA3: "Particular cobrada" / "Particular sin cobrar"** — el estado de cobro lo define US-029. Queda "Particular" sin estado.
- **CA4: filtro por vacuna** — US-023 descartada; no hay turnos de vacunación que filtrar.
- **CA5: consulta de comprobantes por el Paciente** — los comprobantes los genera US-030.

## Cómo probarlo

1. Ingresar como Administrador → **Reportes**.
2. Elegir **"Prestaciones con cobertura"** en el selector _Reporte_.
3. Definir el período y, opcionalmente, entidad, categoría, médico o especialidad.
4. Tocar **Aplicar filtros**.

Para tener datos: reservar turnos (algunos particulares y otros con cobertura,
usando US-028), y marcarlos como **Atendido** desde la agenda del médico. Un
turno con arancel $0 aparece como **Gratuita**.
