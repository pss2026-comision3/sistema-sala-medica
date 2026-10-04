# Priorización de Requerimientos — SIGSAM

**Proyecto:** Sistema Integral de Gestión para Sala Médica (SIGSAM)  
**Código:** PSS-2026-E2  
**Comisión:** 4 – Análisis y Management  
**Fecha:** 24/09/2026

---

## 1. Criterios de Priorización

La priorización se realizó considerando los siguientes criterios:

| Criterio | Descripción |
|----------|-------------|
| **Valor de negocio** | ¿Cuánto impacta en la operación diaria de la sala médica? |
| **Dependencias técnicas** | ¿Cuántos otros requerimientos dependen de este? |
| **Riesgo de no implementarlo** | ¿Qué consecuencias tiene postergar este requerimiento? |
| **Complejidad** | ¿Cuánto esfuerzo requiere implementarlo? |
| **Alineación con el MVP** | ¿Es parte del sistema mínimo funcional? |

Se utilizó la escala **Alta / Media / Baja**:
- **Alta**: Esencial para el MVP. Sin este requerimiento el sistema no es utilizable.
- **Media**: Importante para la operación completa, pero el sistema funciona de forma básica sin él.
- **Baja**: Deseable, pero puede postergarse sin afectar la operación core.

---

## 2. Priorización de Requerimientos Funcionales (RF)

### 🔴 Prioridad ALTA (9 RF) — Fundamentales para el MVP

| ID | Nombre | Prioridad | Justificación | Sprint Sugerido |
|----|--------|:---------:|---------------|:---------------:|
| **RF-07** | Autenticación, Sesión y Recuperación de Acceso | **Alta** | Es el punto de entrada al sistema. Sin autenticación no hay sistema funcional. No depende de ningún otro RF. | **Sprint 1** |
| **RF-06** | Gestión de Cuentas del Personal y Desactivación | **Alta** | Necesario para crear las cuentas de médicos, enfermeras y administradores. Dependencia directa de RF-07. Base para todos los módulos que requieren usuarios. | **Sprint 1** |
| **RF-08** | Registro de Pacientes y Tutores de Menores | **Alta** | Los pacientes son los principales usuarios del sistema. Sin pacientes registrados no hay turnos ni atención. El registro es exclusivamente asistido (por el Administrador/Secretaría). | **Sprint 1** |
| **RF-09** | Configuración de Duraciones y Aranceles | **Alta** | Configura la duración de turnos y los aranceles por médico. Sin esta configuración no se pueden generar cupos en la agenda. Es prerrequisito de RF-01. | **Sprint 1** |
| **RF-01** | Gestión de Disponibilidad Médica | **Alta** | Es la base de la agenda. Sin disponibilidad cargada no se pueden ofrecer turnos. Los médicos la necesitan para operar. Depende de RF-06 y RF-09. | **Sprint 1** |
| **RF-02** | Búsqueda y Reserva de Turnos Médicos | **Alta** | Funcionalidad central del sistema: los pacientes buscan y reservan turnos. Es el objetivo principal del POS (50% de turnos por autogestión). Depende de RF-01 y RF-08. | **Sprint 1** |
| **RF-11** | Cancelación de Turnos por el Paciente | **Alta** | Complemento directo de la reserva. Los pacientes necesitan poder cancelar turnos. Libera cupos para otros pacientes. Depende de RF-02. | **Sprint 2** |
| **RF-04** | Registro y Consulta de Historia Clínica | **Alta** | Funcionalidad clínica central. Los médicos documentan la atención y los pacientes consultan su historial. Depende de RF-02 y RF-13. | **Sprint 2** |
| **RF-13** | Registro del Resultado de Atención | **Alta** | Registra si el paciente fue atendido o estuvo ausente. Necesario para reportes de ausentismo (objetivo del POS: reducir 40%) y para completar la historia clínica. | **Sprint 2** |
| **RF-19** | Notificaciones y Recordatorios | **Alta** | Directamente vinculado al objetivo del POS de reducir el ausentismo un 40%. Envía confirmaciones, cancelaciones y recordatorios 24 hs antes. Depende de RF-02, RF-03, RF-10, RF-11. | **Sprint 2** |

### 🟡 Prioridad MEDIA (12 RF) — Importantes para operación completa

| ID | Nombre | Prioridad | Justificación | Sprint Sugerido |
|----|--------|:---------:|---------------|:---------------:|
| **RF-10** | Suspensión de Jornadas de Atención | **Media** | Necesario para gestionar imprevistos médicos. Complementa la agenda pero no es bloqueante para la operación básica. | **Sprint 2** |
| **RF-12** | Gestión Presencial de Turnos y Reprogramación | **Media** | Permite que el personal asista a pacientes presencialmente. Complementa el flujo de turnos pero el sistema funciona con solo autogestión. | **Sprint 2** |
| **RF-03** | Gestión de Stock de Vacunas | **Media** | Módulo de vacunación completo. Importante pero la sala funciona sin él inicialmente. Incluye catálogo, stock por lote y alertas. | **Sprint 3** |
| **RF-14** | Agenda del Vacunatorio | **Media** | Genera cupos de 15 min para vacunación. Forma parte del circuito de vacunación y depende de RF-06 y RF-09. | **Sprint 3** |
| **RF-15** | Reserva de Turnos de Vacunación | **Media** | Permite reservar vacunas con compromiso de dosis. Depende de RF-03 y RF-14. | **Sprint 3** |
| **RF-16** | Registro de Aplicación de Vacunas | **Media** | Registra la aplicación efectiva y descuenta stock. Depende de RF-03 y RF-15. | **Sprint 3** |
| **RF-17** | Catálogo de Obras Sociales | **Media** | ABM de entidades de cobertura. Necesario para registrar coberturas pero el sistema opera sin él (todos como particular). | **Sprint 3** |
| **RF-18** | Registro de Cobertura Médica del Paciente | **Media** | Vincula la obra social al paciente. Depende de RF-08 y RF-17. | **Sprint 3** |
| **RF-05** | Cobros Presenciales y Facturación Simulada | **Media** | Cobros simulados y generación de facturas PDF. No es core pero es necesario para la administración. Planificado para Sprint 3 según WBS y plan RSGR. | **Sprint 3** |
| **RF-20** | Reportes Administrativos | **Media** | Reportes de ocupación, ausentismo, stock y cobros. Requiere datos acumulados de sprints anteriores para ser útil. | **Sprint 3** |
| **RF-21** | Auditoría y Trazabilidad | **Media** | Bitácora de operaciones. Transversal, pero la consulta puede postergarse. Se recomienda implementar el registro desde Sprint 1 y la consulta en Sprint 3. | **Sprint 3** |

### 🟢 Prioridad BAJA (1 RF) — Deseable, postergable

| ID | Nombre | Prioridad | Justificación | Sprint Sugerido |
|----|--------|:---------:|---------------|:---------------:|
| **RF-22** | Gestión de Sobreturnos | **Baja** | Excepción operativa. El sistema funciona completamente sin sobreturnos. Pendiente de validación con la clienta. | **Sprint 2** |

---

## 3. Priorización de Requerimientos No Funcionales (RNF)

> **Nota:** En el documento oficial `Resumen de requerimientos y prioridad.docx`, las 11 RNF tienen prioridad sin asignar ("—"). Se proponen las siguientes prioridades:

### 🔴 Prioridad ALTA (9 RNF) — Seguridad, integridad y experiencia base

| ID | Nombre | Prioridad Sugerida | Justificación |
|----|--------|:-------------------:|---------------|
| **RNF-04** | Seguridad de Sesión | **Alta** | La sesión debe expirar a los 15 min de inactividad. Es requisito para proteger datos sensibles de salud. Debe implementarse desde Sprint 2. |
| **RNF-05** | Protección de Contraseñas y Datos Sensibles | **Alta** | Hashing de contraseñas y cifrado HTTPS. Requisito de seguridad básico y legalmente relevante (datos de salud). Desde Sprint 1. |
| **RNF-06** | Control de Acceso por Rol | **Alta** | Verificación de permisos en servidor por cada operación. Fundamental para el modelo de 4 roles fijos. Desde Sprint 1. |
| **RNF-07** | Consistencia ante Operaciones Concurrentes | **Alta** | Evita doble reserva del mismo cupo y stock negativo. Clave para la integridad de turnos y vacunas. Desde Sprint 1 (turnos) y Sprint 3 (vacunas). |
| **RNF-03** | Compatibilidad Web Responsive | **Alta** | El sistema debe funcionar en navegadores de escritorio y móvil. Es el canal principal de autogestión de pacientes. Desde Sprint 1. |
| **RNF-08** | Conservación de la Información | **Alta** | Prohibición de borrado físico. Desactivación lógica, correcciones como nuevos registros. Decisión arquitectónica desde Sprint 1. |
| **RNF-01** | Desempeño en Reportes | **Alta** | Los reportes deben generarse en ≤5 segundos. Relevante para Sprint 3 cuando se implementen los reportes, pero el diseño de datos debe ser eficiente desde el inicio. |
| **RNF-02** | Eficiencia de Recordatorios (Ausentismo) | **Alta** | Vinculado al objetivo del POS de reducir ausentismo 40%. La métrica debe medirse desde que se activen los recordatorios (Sprint 2). |
| **RNF-09** | Confiabilidad de las Notificaciones | **Alta** | Tolerancia a fallos en email con reintento y aviso interno como respaldo. Crítico para la comunicación con pacientes desde Sprint 2. |

### 🟡 Prioridad MEDIA (2 RNF) — Importantes, menos urgentes

| ID | Nombre | Prioridad Sugerida | Justificación |
|----|--------|:-------------------:|---------------|
| **RNF-10** | Mantenibilidad de la Integración de Pagos | **Media** | La lógica de cobro debe estar aislada para futuro reemplazo por pasarela real. Relevante desde Sprint 3 cuando se implemente el módulo de cobros. |
| **RNF-11** | Usabilidad y Atención Asistida | **Media** | Interfaz intuitiva con tiempos ≤3 min para reservar. Importante pero verificable como prueba de usabilidad, no como restricción técnica inmediata. |

---

## 4. Resumen de Distribución por Sprint

| Sprint | RF Alta | RF Media | RF Baja | Total RF |
|--------|:-------:|:--------:|:-------:|:--------:|
| **Sprint 1** | 6 (RF-01, 02, 06, 07, 08, 09) | 0 | 0 | **6** |
| **Sprint 2** | 4 (RF-04, 11, 13, 19) | 2 (RF-12, 10) | 1 (RF-22) | **7** |
| **Sprint 3** | 0 | 9 (RF-03, 05, 14-18, 20, 21) | 0 | **9** |
| **Total** | **10** | **11** | **1** | **22** |