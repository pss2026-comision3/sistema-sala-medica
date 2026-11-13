# Guía de Integración de Nuevos Reportes — SIGSAM

Esta guía explica cómo sumar nuevos reportes (como **US-SIG-034 Ocupación**, **US-SIG-036 Inventario** o **US-SIG-037 Cobros**) al módulo unificado de reportes (`/admin/reportes`).

---

### Paso 1: Registrar el reporte en el catálogo (`src/lib/reportes/registry.ts`)

1. Agregá el identificador único al type `TipoReporte`:

   ```typescript
   export type TipoReporte =
     | "asistencia_recordatorios"
     | "inventario" // <-- Tu nuevo reporte
     | "turnos_ocupacion"
     | "cobros_cobertura";
   ```

2. Agregá la definición en el arreglo `CATALOGO_REPORTES`:
   ```typescript
   {
     id: "inventario",
     titulo: "Inventario de vacunas y movimientos",
     descripcion: "Consulta existencias físicas, comprometidas y evolución histórica de lotes.",
     rolesPermitidos: ["ADMIN"],
   }
   ```
   _El desplegable "Reporte \*" de la pantalla `/admin/reportes` se actualizará automáticamente con esta opción._

---

### Paso 2: Crear los tipos y el servicio de consulta (`src/lib/reportes/`)

1. En `src/lib/reportes/tipos.ts`, agregá las interfaces para los filtros y resultados de tu reporte:

   ```typescript
   export interface FiltrosReporteInventario {
     desde?: string;
     hasta?: string;
     vacunaId?: string;
   }

   export interface ResultadoReporteInventario {
     stockActual: Array<{ vacuna: string; disponible: number }>;
     movimientos: Array<{ fecha: string; tipo: string; cantidad: number }>;
   }
   ```

2. Creá tu servicio de consulta en `src/lib/reportes/inventario.ts` (o el nombre de tu reporte):
   ```typescript
   import { prisma } from "@/lib/db/prisma";

   export async function consultarReporteInventario(
     filtros: FiltrosReporteInventario,
   ) {
     // Tu lógica con Prisma ORM...
     return {/* ... */};
   }
   ```

---

### Paso 3: Exponer la Server Action (`src/app/actions/reportes.ts`)

En `src/app/actions/reportes.ts`, agregá la Server Action para invocar tu consulta desde el cliente con validación de roles:

```typescript
export async function obtenerReporteInventarioAction(
  filtros: FiltrosReporteInventario,
) {
  try {
    const sesion = await requireRole("ADMIN"); // o requireAlgunRol(...)
    const datos = await consultarReporteInventario(filtros);
    return { exito: true, datos };
  } catch (error) {
    return { exito: false, error: (error as Error).message };
  }
}
```

---

### Paso 4: Conectar filtros y visualización en la UI (`src/app/(app)/admin/reportes/`)

1. **Creá tu componente de vista** (por ejemplo `src/app/(app)/admin/reportes/vista-inventario.tsx`):

   ```tsx
   export function VistaInventarioReporte({
     resultado,
   }: {
     resultado: ResultadoReporteInventario;
   }) {
     return <div>{/* Tus tarjetas de KPI, tablas o gráficos */}</div>;
   }
   ```

2. **Conectalo en `reportes-view.tsx`**:
   - En la grilla de filtros (`<div className="sigsam-form-grid">`), agregá los campos que corresponden a tu reporte cuando `tipoReporte === "inventario"`.
   - En el `handleSubmit`, ejecutá tu action si `tipoReporte === "inventario"`.
   - En la sección de resultados, renderizá tu componente:
     ```tsx
     {
       tipoReporte === "inventario" && resultadoInventario && (
         <VistaInventarioReporte resultado={resultadoInventario} />
       );
     }
     ```
