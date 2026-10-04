# Contexto del Proyecto — Sistema de Gestión para Sala Médica

> Documento de traspaso para continuar el trabajo en otra sesión de opencode.
> Última actualización: 2026-10-04

> **Antes de tocar el código, leé `docs/DECISIONES.md`** (registro de decisiones
> ya tomadas que no deben revertirse sin discusión). Para configurar la base
> por primera vez, seguí `docs/SUPABASE.md`.

---

## 1. Datos generales

- **Materia:** Proyectos de Sistemas de Software (PSS) 2026 — Comisión 3 (implementación).
- **Enunciado:** Nº 2 — Sala médica. La comisión de análisis entregó la documentación (carpeta "Para Comision 3").
- **Integrantes:** ~10 alumnos. Tope ~10 h/semana por alumno.
- **Repositorio:** `pss2026-comision3/sistema-sala-medica` (GitHub, org `pss2026-comision3`).
- **Ruta local del repo:** `D:\Usuario\Emiliano\Emiliano\UNS\CuartoAnio\SegundoCuatrimestre\Proyectos de sistemas de software\Proyecto\sistema-sala-medica`
- **Carpeta con la documentación original:** `D:\Usuario\Descargas\Para Comision 3-20261004T194314Z-1-001`

### Fechas clave (Sprint 1)
- **Demo Sprint 1:** 08/10
- **Entrega Sprint 1:** 11/10

### Reglas del enunciado a respetar
- Si algún alumno **no cursó desarrollo web**, la implementación puede ser **app de escritorio** (no aprender web en la materia).
- **Uso de IA permitido**, pero debe documentarse (prompt / modelo / versión) en los informes. La estimación del Sprint 1 se hizo **sin IA**.
- Documentación se entrega por Google Drive. Demos con ayudante al final de cada sprint.

---

## 2. Alcance del sistema

**SIGSAM** — Sistema Integral de Gestión para Sala Médica. Gestiona turnos, agenda de profesionales, pacientes, vacunación, cobros, obras sociales, reportes y auditoría.

- **Total:** 40 historias de usuario en 3 sprints (12 / 12 / 16).
- **Roles fijos:** Admin, Médico, Enfermería, Paciente. **Sin autorregistro**: el Admin crea las cuentas.

### Sprint 1 (12 USs)
| US | Descripción | Dificultad |
|----|-------------|-----------|
| US-SIG-001 | Login | media/transversal |
| US-SIG-002 | Alta de paciente adulto | media-alta |
| US-SIG-003 | Alta de menor + tutor | media-alta |
| US-SIG-004 | Crear cuentas de personal | muy baja |
| US-SIG-005 | Desactivar cuenta | baja-media |
| US-SIG-006 | Recuperar acceso / contraseña | baja |
| US-SIG-007 | Configurar duración de turno / arancel | muy baja |
| US-SIG-008 | Publicar disponibilidad mensual | alta |
| US-SIG-010 | Consultar agenda | media |
| US-SIG-011 | Buscar horarios | alta |
| US-SIG-012 | Confirmar reserva (retención 5 min / concurrencia) | la más difícil |
| US-SIG-013 | Consultar turnos | media |

- **Sprint 2:** US 009, 014, 015, 016, 017, 018, 019, 020, 031, 032, 033 + sobreturno.
- **Sprint 3:** vacunación (021–027), cobros (028–030 + OOSS), reportes (034–038), auditoría (039).

### Dependencias del Sprint 1 (flujo oficial)
```
US-001 → 006
US-001 → 004 → 005
US-001 → 002 → 003
US-004 → 007 → 008 → {010, 011}
US-011 → 012 → 013
```
Dependencias de RF: RF-06→RF-07; RF-09→RF-06; RF-01→RF-06 y RF-09; RF-02→RF-01 y RF-08; RF-08→RF-07 y RF-17.

---

## 3. Distribución de las 12 USs entre 10 personas (ACORDADA)

Regla: división pareja; a 2 personas les tocan 2 USs cada una, y esas 2 USs deben ser de las más fáciles (1 muy baja + 1 baja cada persona).

Ordenadas por el flujo de dependencias:

| Persona | US asignada(s) |
|---------|----------------|
| Persona 1 | US-SIG-001 |
| Persona 2 | US-SIG-006 + US-SIG-007 |
| Persona 3 | US-SIG-004 + US-SIG-005 |
| Persona 4 | US-SIG-002 |
| Persona 5 | US-SIG-003 |
| Persona 6 | US-SIG-008 |
| Persona 7 | US-SIG-010 |
| Persona 8 | US-SIG-011 |
| Persona 9 | US-SIG-012 |
| Persona 10 | US-SIG-013 |

Nota: las segundas USs de P2 (007) y P3 (005) recién se necesitan en fase 3 del flujo, por lo que no atrasan el camino crítico.

**Login sin pacientes:** el Admin inicial se **siembra (seed)** en la base de datos en la puesta en marcha (CA5 de US-004). No hay autorregistro; los datos de prueba de Médico/Paciente se cargan como fixtures/seed.

---

## 4. Modelo de datos (de `baseDeDatos.md`)

PostgreSQL. Mermaid `erDiagram`. Tipos `bigserial` / `decimal` / `timestamptz`.

Tablas relevantes:
- `persona(id, nombre_completo)`
- `usuario(id, persona_id FK+UK, email UK, password_hash, rol, activo, clave_temporal)`
- `obra_social(id, nombre UK, activa)`
- `paciente(persona_id PK/FK, dni, fecha_nacimiento, telefono, tutor_id FK, obra_social_id FK, plan, numero_afiliado)`
- `especialidad(id, nombre UK)`
- `medico(usuario_id PK/FK, especialidad_id FK, duracion_turno_min, arancel_actual)`
- `disponibilidad(profesional_id FK, fecha, hora_desde, hora_hasta, estado, motivo_suspension, suspendida_en, suspendida_por FK)`
- `vacuna(...)` y varias más (el archivo tiene ~242 líneas).

Para US-001 alcanza con `persona` + `usuario`.

---

## 5. Stack y decisiones tomadas

| Tema | Decisión |
|------|----------|
| Frontend/Backend | **Next.js** (App Router) + TypeScript |
| Base de datos | **PostgreSQL en Supabase** (proyecto compartido para desarrollo) |
| ORM / migraciones | **Prisma** |
| UI | **Tailwind CSS** (sin shadcn por ahora) |
| Auth | **Auth propia en Next.js** — NO Supabase Auth |
| Deploy de demo | **Vercel** (propuesto) |

### Por qué auth propia (no Supabase Auth)
El sistema exige comportamientos atípicos:
- **Sin autorregistro**: las cuentas las crea el Admin.
- **Clave temporal** con **cambio forzado** en el primer ingreso (el campo `clave_temporal` en `usuario`).
- **Sesión que expira a los 15 min de inactividad**.
- **4 roles fijos**.
Supabase Auth no modela esto sin fricción, por eso se usa Supabase **solo como Postgres**.

---

## 6. US-SIG-001 (Login) — criterios de aceptación a cumplir

- **CA1:** Login con email + contraseña; hash bcrypt/argon2; **error genérico** que no revele si el email existe.
- **CA2:** Menú/rutas según rol; bloquear acceso directo por URL a funciones no autorizadas.
- **CA3:** Si `clave_temporal = true` → **redirigir forzadamente** a "definir nueva contraseña" (≥8 caracteres, distinta de la temporal) antes de habilitar el resto.
- **CA4:** **Logout** y expiración de sesión a los **15 min de inactividad**.
- **CA5:** UI **responsive** desktop/móvil (sin app nativa).

---

## 7. Estado actual y próximos pasos

### Hecho
- [x] Reparto de las 12 USs del Sprint 1 (tabla de la sección 3).
- [x] Creación de la organización `pss2026-comision3` y del repo `sistema-sala-medica`.
- [x] Repo clonado localmente en la ruta indicada en la sección 1. Está vacío (rama `main`, **sin commits**).
- [x] Decisiones de stack (sección 5).

### Pendiente (Fase 0 — scaffold)
- [ ] Scaffold Next.js + TS + Tailwind + ESLint/Prettier.
- [ ] Estructura de carpetas: `src/app`, `src/app/api`, `src/lib/db`, `src/lib/auth`, `prisma/`.
- [ ] `.gitignore`, `.env.example` (`DATABASE_URL`, `SESSION_SECRET`), README con instrucciones de arranque.
- [ ] Prisma: migración inicial (`persona`, `usuario`) + **seed del Admin** con `clave_temporal`.
- [ ] Convención de ramas `feature/us-XXX-descripcion`, PR template y protección de `main`.
- [ ] Commit inicial a `main`.
- [ ] Crear proyecto Supabase compartido y repartir `DATABASE_URL` de forma segura.

### Siguiente (Fase 2 — US-001)
- [ ] `POST /api/auth/login`, logout, sesión 15 min inactividad, control por rol, cambio forzado de clave temporal, UI responsive.

---

## 8. Riesgos
- **Tiempo:** demo del Sprint 1 el 08/10 (≈4 días). Arrancar de cero está muy justo. Se sugiere llevar a la demo el flujo `001 → 004 → 002 → 008 → 012` aunque otras USs queden a medio terminar.
- **Pisarse en el repo:** fijar primero las piezas compartidas (layout, middleware, cliente DB, tipos, seed) antes de que el resto empiece en paralelo.
- **Experiencia con Next.js:** verificar que todos tengan base web; si no, recordar la opción de app de escritorio del enunciado.

---

## 9. Cómo continuar esta sesión

El ID de la sesión anterior de opencode era `ses_ef78b13e7ffebVFwn4j5683KP6`. Para retomarla en la ruta del repo:

```powershell
opencode "D:\Usuario\Emiliano\Emiliano\UNS\CuartoAnio\SegundoCuatrimestre\Proyectos de sistemas de software\Proyecto\sistema-sala-medica" --session ses_ef78b13e7ffebVFwn4j5683KP6
```

Si las rutas de la sesión vieja se mezclan, agregar `--fork`. Alternativa: iniciar una sesión nueva en la ruta del repo y pasarle este archivo como contexto.

---

## 10. Documentación original de referencia

Ubicada en `D:\Usuario\Descargas\Para Comision 3-20261004T194314Z-1-001`:
- `ENUNCIADO.pdf`
- `Para Comision 3/baseDeDatos.md` y `baseDeDatos.png`
- `Para Comision 3/Distribucion de USs por Sprint.md`
- `Para Comision 3/Priorizacion de Requerimientos.md`
- `Para Comision 3/Requerimientos.docx`
- `Para Comision 3/USs Completo.docx`
- `Para Comision 3/Wireframe Sprint 1.html`
