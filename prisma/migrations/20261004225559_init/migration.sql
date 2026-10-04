-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'MEDICO', 'ENFERMERIA', 'PACIENTE');

-- CreateEnum
CREATE TYPE "EstadoTurno" AS ENUM ('RESERVADO', 'CONFIRMADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoDisponibilidad" AS ENUM ('PUBLICADA', 'SUSPENDIDA');

-- CreateEnum
CREATE TYPE "ResultadoAtencion" AS ENUM ('SIN_REGISTRAR', 'ATENDIDO', 'AUSENTE');

-- CreateEnum
CREATE TYPE "TipoTurno" AS ENUM ('CONSULTA', 'VACUNACION');

-- CreateEnum
CREATE TYPE "ModalidadCobertura" AS ENUM ('PARTICULAR', 'CON_COBERTURA');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('COMPRA', 'APLICACION', 'AJUSTE');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('APROBADO', 'RECHAZADO', 'CANCELADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "TipoEventoEmail" AS ENUM ('CONFIRMACION', 'CANCELACION', 'SUSPENSION', 'RECORDATORIO', 'ALERTA_STOCK');

-- CreateEnum
CREATE TYPE "ResultadoIntentoEmail" AS ENUM ('EXITO', 'FALLIDO');

-- CreateTable
CREATE TABLE "persona" (
    "id" BIGSERIAL NOT NULL,
    "nombre_completo" VARCHAR(255) NOT NULL,

    CONSTRAINT "persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" BIGSERIAL NOT NULL,
    "persona_id" BIGINT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "clave_temporal" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesion" (
    "id" BIGSERIAL NOT NULL,
    "usuario_id" BIGINT NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultima_actividad" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizada_en" TIMESTAMPTZ(6),

    CONSTRAINT "sesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obra_social" (
    "id" BIGSERIAL NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "obra_social_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paciente" (
    "persona_id" BIGINT NOT NULL,
    "dni" VARCHAR(20) NOT NULL,
    "fecha_nacimiento" DATE NOT NULL,
    "telefono" VARCHAR(30) NOT NULL,
    "tutor_id" BIGINT,
    "obra_social_id" BIGINT,
    "plan" VARCHAR(120),
    "numero_afiliado" VARCHAR(80),

    CONSTRAINT "paciente_pkey" PRIMARY KEY ("persona_id")
);

-- CreateTable
CREATE TABLE "especialidad" (
    "id" BIGSERIAL NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,

    CONSTRAINT "especialidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medico" (
    "usuario_id" BIGINT NOT NULL,
    "especialidad_id" BIGINT,
    "duracion_turno_min" SMALLINT NOT NULL,
    "arancel_actual" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "medico_pkey" PRIMARY KEY ("usuario_id")
);

-- CreateTable
CREATE TABLE "disponibilidad" (
    "id" BIGSERIAL NOT NULL,
    "profesional_id" BIGINT NOT NULL,
    "fecha" DATE NOT NULL,
    "hora_desde" TIME(6) NOT NULL,
    "hora_hasta" TIME(6) NOT NULL,
    "estado" "EstadoDisponibilidad" NOT NULL DEFAULT 'PUBLICADA',
    "motivo_suspension" TEXT,
    "suspendida_en" TIMESTAMPTZ(6),
    "suspendida_por" BIGINT,

    CONSTRAINT "disponibilidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vacuna" (
    "id" BIGSERIAL NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "descripcion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "umbral_minimo" INTEGER NOT NULL,
    "arancel_actual" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "vacuna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lote_vacuna" (
    "id" BIGSERIAL NOT NULL,
    "vacuna_id" BIGINT NOT NULL,
    "codigo" VARCHAR(100) NOT NULL,
    "fecha_vencimiento" DATE NOT NULL,
    "utilizable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "lote_vacuna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turno" (
    "id" BIGSERIAL NOT NULL,
    "paciente_id" BIGINT NOT NULL,
    "disponibilidad_id" BIGINT NOT NULL,
    "creado_por" BIGINT NOT NULL,
    "tipo" "TipoTurno" NOT NULL,
    "vacuna_id" BIGINT,
    "lote_reservado_id" BIGINT,
    "hora" TIME(6) NOT NULL,
    "duracion_min" SMALLINT NOT NULL,
    "arancel" DECIMAL(10,2) NOT NULL,
    "modalidad" "ModalidadCobertura" NOT NULL,
    "obra_social_id" BIGINT,
    "cobertura_nombre_snapshot" VARCHAR(255),
    "cobertura_plan_snapshot" VARCHAR(120),
    "afiliado_snapshot" VARCHAR(120),
    "estado" "EstadoTurno" NOT NULL,
    "resultado" "ResultadoAtencion" NOT NULL DEFAULT 'SIN_REGISTRAR',
    "es_sobreturno" BOOLEAN NOT NULL DEFAULT false,
    "motivo_sobreturno" TEXT,
    "retenido_hasta" TIMESTAMPTZ(6),
    "atendido_en" TIMESTAMPTZ(6),
    "cancelado_en" TIMESTAMPTZ(6),
    "cancelado_por" BIGINT,
    "origen_cancelacion" VARCHAR(40),
    "motivo_cancelacion" TEXT,
    "reprogramado_desde_id" BIGINT,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consulta" (
    "turno_id" BIGINT NOT NULL,
    "autor_id" BIGINT NOT NULL,
    "diagnostico" TEXT NOT NULL,
    "sintomas" TEXT,
    "indicaciones" TEXT,
    "medicacion" TEXT,
    "estudios" TEXT,
    "observaciones" TEXT,
    "certificado" TEXT,
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consulta_pkey" PRIMARY KEY ("turno_id")
);

-- CreateTable
CREATE TABLE "correccion" (
    "id" BIGSERIAL NOT NULL,
    "consulta_turno_id" BIGINT NOT NULL,
    "autor_id" BIGINT NOT NULL,
    "texto" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adjunto" (
    "id" BIGSERIAL NOT NULL,
    "consulta_turno_id" BIGINT NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "ruta_privada" TEXT NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "tamano_bytes" BIGINT NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adjunto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimiento_stock" (
    "id" BIGSERIAL NOT NULL,
    "lote_id" BIGINT NOT NULL,
    "turno_id" BIGINT,
    "registrado_por" BIGINT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "motivo" TEXT,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimiento_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pago_manual" (
    "id" BIGSERIAL NOT NULL,
    "turno_id" BIGINT NOT NULL,
    "registrado_por" BIGINT NOT NULL,
    "importe" DECIMAL(10,2) NOT NULL,
    "medio" VARCHAR(40),
    "estado" "EstadoPago" NOT NULL,
    "motivo_anulacion" TEXT,
    "registrado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pago_manual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprobante_turno" (
    "id" BIGSERIAL NOT NULL,
    "turno_id" BIGINT NOT NULL,
    "generado_por" BIGINT NOT NULL,
    "paciente_snapshot" VARCHAR(255) NOT NULL,
    "prestacion_snapshot" VARCHAR(255) NOT NULL,
    "fecha_turno_snapshot" DATE NOT NULL,
    "hora_turno_snapshot" TIME(6) NOT NULL,
    "estado_snapshot" VARCHAR(40) NOT NULL,
    "resultado_snapshot" VARCHAR(40) NOT NULL,
    "archivo_privado" TEXT,
    "generado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprobante_turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento_email" (
    "id" BIGSERIAL NOT NULL,
    "destinatario_id" BIGINT NOT NULL,
    "turno_id" BIGINT,
    "vacuna_id" BIGINT,
    "tipo_evento" "TipoEventoEmail" NOT NULL,
    "clave_evento" VARCHAR(255) NOT NULL,
    "email_destino_snapshot" VARCHAR(255) NOT NULL,
    "asunto" VARCHAR(255) NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "programado_en" TIMESTAMPTZ(6) NOT NULL,
    "cancelado_en" TIMESTAMPTZ(6),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intento_email" (
    "id" BIGSERIAL NOT NULL,
    "evento_id" BIGINT NOT NULL,
    "numero" SMALLINT NOT NULL,
    "resultado" "ResultadoIntentoEmail" NOT NULL,
    "error" TEXT,
    "intentado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intento_email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" BIGSERIAL NOT NULL,
    "actor_id" BIGINT,
    "accion" VARCHAR(80) NOT NULL,
    "entidad" VARCHAR(80) NOT NULL,
    "referencia_id" BIGINT,
    "detalle" TEXT,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_persona_id_key" ON "usuario"("persona_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sesion_token_hash_key" ON "sesion"("token_hash");

-- CreateIndex
CREATE INDEX "sesion_usuario_id_idx" ON "sesion"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "obra_social_nombre_key" ON "obra_social"("nombre");

-- CreateIndex
CREATE INDEX "paciente_dni_idx" ON "paciente"("dni");

-- CreateIndex
CREATE INDEX "paciente_tutor_id_idx" ON "paciente"("tutor_id");

-- CreateIndex
CREATE INDEX "paciente_obra_social_id_idx" ON "paciente"("obra_social_id");

-- CreateIndex
CREATE UNIQUE INDEX "especialidad_nombre_key" ON "especialidad"("nombre");

-- CreateIndex
CREATE INDEX "medico_especialidad_id_idx" ON "medico"("especialidad_id");

-- CreateIndex
CREATE INDEX "disponibilidad_profesional_id_fecha_idx" ON "disponibilidad"("profesional_id", "fecha");

-- CreateIndex
CREATE INDEX "disponibilidad_estado_idx" ON "disponibilidad"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "disponibilidad_profesional_id_fecha_hora_desde_hora_hasta_key" ON "disponibilidad"("profesional_id", "fecha", "hora_desde", "hora_hasta");

-- CreateIndex
CREATE UNIQUE INDEX "vacuna_nombre_key" ON "vacuna"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "lote_vacuna_codigo_key" ON "lote_vacuna"("codigo");

-- CreateIndex
CREATE INDEX "lote_vacuna_vacuna_id_utilizable_idx" ON "lote_vacuna"("vacuna_id", "utilizable");

-- CreateIndex
CREATE UNIQUE INDEX "turno_reprogramado_desde_id_key" ON "turno"("reprogramado_desde_id");

-- CreateIndex
CREATE INDEX "turno_paciente_id_estado_idx" ON "turno"("paciente_id", "estado");

-- CreateIndex
CREATE INDEX "turno_disponibilidad_id_estado_idx" ON "turno"("disponibilidad_id", "estado");

-- CreateIndex
CREATE INDEX "turno_estado_resultado_idx" ON "turno"("estado", "resultado");

-- CreateIndex
CREATE INDEX "turno_creado_por_idx" ON "turno"("creado_por");

-- CreateIndex
CREATE INDEX "turno_obra_social_id_idx" ON "turno"("obra_social_id");

-- CreateIndex
CREATE INDEX "consulta_autor_id_idx" ON "consulta"("autor_id");

-- CreateIndex
CREATE INDEX "consulta_creada_en_idx" ON "consulta"("creada_en");

-- CreateIndex
CREATE INDEX "correccion_consulta_turno_id_idx" ON "correccion"("consulta_turno_id");

-- CreateIndex
CREATE INDEX "correccion_autor_id_idx" ON "correccion"("autor_id");

-- CreateIndex
CREATE INDEX "adjunto_consulta_turno_id_idx" ON "adjunto"("consulta_turno_id");

-- CreateIndex
CREATE UNIQUE INDEX "movimiento_stock_turno_id_key" ON "movimiento_stock"("turno_id");

-- CreateIndex
CREATE INDEX "movimiento_stock_lote_id_creado_en_idx" ON "movimiento_stock"("lote_id", "creado_en");

-- CreateIndex
CREATE INDEX "movimiento_stock_registrado_por_idx" ON "movimiento_stock"("registrado_por");

-- CreateIndex
CREATE INDEX "pago_manual_turno_id_idx" ON "pago_manual"("turno_id");

-- CreateIndex
CREATE INDEX "pago_manual_registrado_por_idx" ON "pago_manual"("registrado_por");

-- CreateIndex
CREATE INDEX "pago_manual_estado_idx" ON "pago_manual"("estado");

-- CreateIndex
CREATE INDEX "comprobante_turno_turno_id_idx" ON "comprobante_turno"("turno_id");

-- CreateIndex
CREATE INDEX "comprobante_turno_generado_por_idx" ON "comprobante_turno"("generado_por");

-- CreateIndex
CREATE UNIQUE INDEX "evento_email_clave_evento_key" ON "evento_email"("clave_evento");

-- CreateIndex
CREATE INDEX "evento_email_destinatario_id_idx" ON "evento_email"("destinatario_id");

-- CreateIndex
CREATE INDEX "evento_email_turno_id_idx" ON "evento_email"("turno_id");

-- CreateIndex
CREATE INDEX "evento_email_vacuna_id_idx" ON "evento_email"("vacuna_id");

-- CreateIndex
CREATE INDEX "evento_email_programado_en_idx" ON "evento_email"("programado_en");

-- CreateIndex
CREATE INDEX "intento_email_evento_id_idx" ON "intento_email"("evento_id");

-- CreateIndex
CREATE INDEX "auditoria_actor_id_creado_en_idx" ON "auditoria"("actor_id", "creado_en");

-- CreateIndex
CREATE INDEX "auditoria_entidad_referencia_id_idx" ON "auditoria"("entidad", "referencia_id");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesion" ADD CONSTRAINT "sesion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paciente" ADD CONSTRAINT "paciente_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paciente" ADD CONSTRAINT "paciente_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "paciente"("persona_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paciente" ADD CONSTRAINT "paciente_obra_social_id_fkey" FOREIGN KEY ("obra_social_id") REFERENCES "obra_social"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medico" ADD CONSTRAINT "medico_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medico" ADD CONSTRAINT "medico_especialidad_id_fkey" FOREIGN KEY ("especialidad_id") REFERENCES "especialidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilidad" ADD CONSTRAINT "disponibilidad_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilidad" ADD CONSTRAINT "disponibilidad_suspendida_por_fkey" FOREIGN KEY ("suspendida_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote_vacuna" ADD CONSTRAINT "lote_vacuna_vacuna_id_fkey" FOREIGN KEY ("vacuna_id") REFERENCES "vacuna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno" ADD CONSTRAINT "turno_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("persona_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno" ADD CONSTRAINT "turno_disponibilidad_id_fkey" FOREIGN KEY ("disponibilidad_id") REFERENCES "disponibilidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno" ADD CONSTRAINT "turno_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno" ADD CONSTRAINT "turno_cancelado_por_fkey" FOREIGN KEY ("cancelado_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno" ADD CONSTRAINT "turno_vacuna_id_fkey" FOREIGN KEY ("vacuna_id") REFERENCES "vacuna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno" ADD CONSTRAINT "turno_lote_reservado_id_fkey" FOREIGN KEY ("lote_reservado_id") REFERENCES "lote_vacuna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno" ADD CONSTRAINT "turno_obra_social_id_fkey" FOREIGN KEY ("obra_social_id") REFERENCES "obra_social"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno" ADD CONSTRAINT "turno_reprogramado_desde_id_fkey" FOREIGN KEY ("reprogramado_desde_id") REFERENCES "turno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consulta" ADD CONSTRAINT "consulta_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consulta" ADD CONSTRAINT "consulta_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "medico"("usuario_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correccion" ADD CONSTRAINT "correccion_consulta_turno_id_fkey" FOREIGN KEY ("consulta_turno_id") REFERENCES "consulta"("turno_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correccion" ADD CONSTRAINT "correccion_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "medico"("usuario_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjunto" ADD CONSTRAINT "adjunto_consulta_turno_id_fkey" FOREIGN KEY ("consulta_turno_id") REFERENCES "consulta"("turno_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_stock" ADD CONSTRAINT "movimiento_stock_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lote_vacuna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_stock" ADD CONSTRAINT "movimiento_stock_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_stock" ADD CONSTRAINT "movimiento_stock_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_manual" ADD CONSTRAINT "pago_manual_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_manual" ADD CONSTRAINT "pago_manual_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobante_turno" ADD CONSTRAINT "comprobante_turno_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobante_turno" ADD CONSTRAINT "comprobante_turno_generado_por_fkey" FOREIGN KEY ("generado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_email" ADD CONSTRAINT "evento_email_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_email" ADD CONSTRAINT "evento_email_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_email" ADD CONSTRAINT "evento_email_vacuna_id_fkey" FOREIGN KEY ("vacuna_id") REFERENCES "vacuna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intento_email" ADD CONSTRAINT "intento_email_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "evento_email"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- SQL a mano (D-16). Prisma no puede expresar indices funcionales ni CHECK.
-- ============================================================================

-- Indices unicos case-insensitive (US-002 CA2, US-041 CA2, US-021 CA1).
CREATE UNIQUE INDEX "usuario_email_lower_udx" ON "usuario" (lower("email"));
CREATE UNIQUE INDEX "obra_social_nombre_lower_udx" ON "obra_social" (lower("nombre"));
CREATE UNIQUE INDEX "vacuna_nombre_lower_udx" ON "vacuna" (lower("nombre"));

-- Coherencia de cobertura del paciente (US-028 CA1): los tres campos de
-- cobertura van juntos, o ninguno.
ALTER TABLE "paciente"
  ADD CONSTRAINT "paciente_cobertura_coherente_chk"
  CHECK (
    ("obra_social_id" IS NULL AND "plan" IS NULL AND "numero_afiliado" IS NULL)
    OR
    ("obra_social_id" IS NOT NULL AND "plan" IS NOT NULL AND "numero_afiliado" IS NOT NULL)
  );

-- Rangos numericos no negociables.
ALTER TABLE "medico"
  ADD CONSTRAINT "medico_duracion_positiva_chk" CHECK ("duracion_turno_min" > 0),
  ADD CONSTRAINT "medico_arancel_no_negativo_chk" CHECK ("arancel_actual" >= 0);

ALTER TABLE "vacuna"
  ADD CONSTRAINT "vacuna_umbral_no_negativo_chk" CHECK ("umbral_minimo" >= 0),
  ADD CONSTRAINT "vacuna_arancel_no_negativo_chk" CHECK ("arancel_actual" >= 0);

ALTER TABLE "turno"
  ADD CONSTRAINT "turno_duracion_positiva_chk" CHECK ("duracion_min" > 0),
  ADD CONSTRAINT "turno_arancel_no_negativo_chk" CHECK ("arancel" >= 0);

ALTER TABLE "movimiento_stock"
  ADD CONSTRAINT "movimiento_stock_cantidad_no_cero_chk" CHECK ("cantidad" <> 0);

ALTER TABLE "pago_manual"
  ADD CONSTRAINT "pago_manual_importe_no_negativo_chk" CHECK ("importe" >= 0);

-- Consistencia de disponibilidad.
ALTER TABLE "disponibilidad"
  ADD CONSTRAINT "disponibilidad_horas_chk" CHECK ("hora_hasta" > "hora_desde"),
  ADD CONSTRAINT "disponibilidad_suspension_chk"
    CHECK (
      "estado" <> 'SUSPENDIDA'
      OR ("motivo_suspension" IS NOT NULL AND "suspendida_en" IS NOT NULL AND "suspendida_por" IS NOT NULL)
    );

-- Consistencia de estado/resultado del turno.
ALTER TABLE "turno"
  ADD CONSTRAINT "turno_reservado_retenido_chk"
    CHECK ("estado" <> 'RESERVADO' OR "retenido_hasta" IS NOT NULL),
  ADD CONSTRAINT "turno_cancelado_chk"
    CHECK (
      "estado" <> 'CANCELADO'
      OR ("cancelado_en" IS NOT NULL AND "cancelado_por" IS NOT NULL AND "motivo_cancelacion" IS NOT NULL)
    ),
  ADD CONSTRAINT "turno_atendido_chk"
    CHECK ("resultado" <> 'ATENDIDO' OR "atendido_en" IS NOT NULL);

-- Consistencia de movimiento de stock y pago.
ALTER TABLE "movimiento_stock"
  ADD CONSTRAINT "movimiento_stock_motivo_ajuste_chk"
    CHECK ("tipo" <> 'AJUSTE' OR "motivo" IS NOT NULL);

ALTER TABLE "pago_manual"
  ADD CONSTRAINT "pago_manual_motivo_anulacion_chk"
    CHECK ("estado" <> 'ANULADO' OR "motivo_anulacion" IS NOT NULL);

-- Contenido obligatorio no vacio.
ALTER TABLE "consulta"
  ADD CONSTRAINT "consulta_diagnostico_no_vacio_chk" CHECK (length(trim("diagnostico")) > 0);

ALTER TABLE "correccion"
  ADD CONSTRAINT "correccion_contenido_no_vacio_chk"
    CHECK (length(trim("texto")) > 0 AND length(trim("motivo")) > 0);
