## Plan de Desarrollo: US-SIG-018 (Correcciones a Consultas)

### 1. Capa de Datos (Consultas Prisma)
- Modificar el servicio actual que recupera la consulta para el médico (`obtenerConsultaClinicaTurno` o equivalente).
- Agregar `include: { correcciones: true }` a la query, ordenando por `creadaEn: 'asc'` para que el historial quede cronológico según el CA3. *(Nota: esto es exclusivo para que el autor pueda leer sus correcciones previas antes de agregar una nueva).*

### 2. Backend (Server Actions)
- Crear una nueva action (ej. `agregarCorreccion` en `consultas.ts`).
- **Validaciones:** 
  - Chequear sesión y rol MEDICO.
  - Verificar que el `usuarioId` actual coincida con el `autorId` de la consulta original (CA1).
  - Validar por Zod que `texto` y `motivo` vengan completos.
- **Mutación:** Hacer el `prisma.correccion.create()` atado al `turnoId`. Cero updates a la tabla consulta original.
- Terminar con un `revalidatePath` para refrescar la ficha de la consulta.

### 3. Frontend (Ficha del Médico)
- En `consulta-detalle-view.tsx` (vista de lectura del médico), agregar una sección debajo de la consulta original que itere y renderice el array de correcciones (mostrando fecha, autor, motivo y texto).
- Agregar un botón "Agregar aclaración/corrección" que abra el form.
- Armar un modal/form simple con dos campos (`<textarea>` o `<input>`) para Motivo y Texto, conectados a la action. 
- Ocultar el botón si el médico que visualiza la ficha no es el autor original de la consulta.
- **Anotación de Maquetado (UI/UX):** Chequear el wireframe correspondiente para replicar el layout, pero *descartar* cualquier funcionalidad extra que figure en el diseño y no esté en los Criterios de Aceptación (ej. ignorar botones de adjuntos de archivos en correcciones).

### 4. Frontend (Buscador Histórico de Consultas Propias)
- **Nueva funcionalidad de acceso rápido:** Crear una vista/página nueva (ej. `/medico/historial-consultas`) exclusiva para el médico.
- Hacer un listado/buscador que recupere todas las consultas donde `autorId` coincida con el médico logueado.
- Al seleccionar o expandir una consulta del listado, reutilizar y renderizar el componente `ConsultaDetalleView`. 
- Esto permite ver la nota original, el diagnóstico, el historial de correcciones y utilizar la opción de "Agregar aclaración" de forma rápida sin tener que navegar al turno específico en la agenda.

### 5. Impacto en el Paciente (Dependencia con US-SIG-020)
- **Aviso:** Actualmente el paciente solo puede ver los datos *administrativos* de sus turnos pasados. La vista de la información clínica ("Mi historia") no existe y debe desarrollarse desde cero.
- Por lo tanto, la visualización de estas correcciones del lado del paciente **queda fuera del alcance de esta us** y será implementada cuando se desarrolle la US-SIG-020.