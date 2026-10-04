erDiagram
    direction LR

    persona {
        bigserial id PK
        varchar nombre_completo
    }

    usuario {
        bigserial id PK
        bigint persona_id FK,UK
        varchar email UK
        text password_hash
        varchar rol
        boolean activo
        boolean clave_temporal
    }

    obra_social {
        bigserial id PK
        varchar nombre UK
        boolean activa
    }

    paciente {
        bigint persona_id PK,FK
        varchar dni
        date fecha_nacimiento
        varchar telefono
        bigint tutor_id FK
        bigint obra_social_id FK
        varchar plan
        varchar numero_afiliado
    }

    especialidad {
        bigserial id PK
        varchar nombre UK
    }

    medico {
        bigint usuario_id PK,FK
        bigint especialidad_id FK
        smallint duracion_turno_min
        decimal arancel_actual
    }

    disponibilidad {
        bigserial id PK
        bigint profesional_id FK
        date fecha
        time hora_desde
        time hora_hasta
        varchar estado
        text motivo_suspension
        timestamptz suspendida_en
        bigint suspendida_por FK
    }

    vacuna {
        bigserial id PK
        varchar nombre UK
        text descripcion
        boolean activa
        integer umbral_minimo
        decimal arancel_actual
    }

    lote_vacuna {
        bigserial id PK
        bigint vacuna_id FK
        varchar codigo UK
        date fecha_vencimiento
        boolean utilizable
    }

    turno {
        bigserial id PK
        bigint paciente_id FK
        bigint disponibilidad_id FK
        bigint creado_por FK
        varchar tipo
        bigint vacuna_id FK
        bigint lote_reservado_id FK
        time hora
        smallint duracion_min
        decimal arancel
        varchar modalidad
        bigint obra_social_id FK
        varchar cobertura_nombre_snapshot
        varchar cobertura_plan_snapshot
        varchar afiliado_snapshot
        varchar estado
        varchar resultado
        boolean es_sobreturno
        text motivo_sobreturno
        timestamptz retenido_hasta
        timestamptz atendido_en
        timestamptz cancelado_en
        bigint cancelado_por FK
        varchar origen_cancelacion
        text motivo_cancelacion
        bigint reprogramado_desde_id FK,UK
        timestamptz creado_en
    }

    consulta {
        bigint turno_id PK,FK
        bigint autor_id FK
        text diagnostico
        text sintomas
        text indicaciones
        text medicacion
        text estudios
        text observaciones
        text certificado
        timestamptz creada_en
    }

    correccion {
        bigserial id PK
        bigint consulta_turno_id FK
        bigint autor_id FK
        text texto
        text motivo
        timestamptz creada_en
    }

    adjunto {
        bigserial id PK
        bigint consulta_turno_id FK
        varchar nombre
        text ruta_privada
        varchar mime_type
        bigint tamano_bytes
        timestamptz creado_en
    }

    movimiento_stock {
        bigserial id PK
        bigint lote_id FK
        bigint turno_id FK,UK
        bigint registrado_por FK
        varchar tipo
        integer cantidad
        text motivo
        timestamptz creado_en
    }

    pago_manual {
        bigserial id PK
        bigint turno_id FK
        bigint registrado_por FK
        decimal importe
        varchar medio
        varchar estado
        text motivo_anulacion
        timestamptz registrado_en
    }

    comprobante_turno {
        bigserial id PK
        bigint turno_id FK
        bigint generado_por FK
        varchar paciente_snapshot
        varchar prestacion_snapshot
        date fecha_turno_snapshot
        time hora_turno_snapshot
        varchar estado_snapshot
        varchar resultado_snapshot
        text archivo_privado
        timestamptz generado_en
    }

    evento_email {
        bigserial id PK
        bigint destinatario_id FK
        bigint turno_id FK
        bigint vacuna_id FK
        varchar tipo_evento
        varchar clave_evento UK
        varchar email_destino_snapshot
        varchar asunto
        text cuerpo
        timestamptz programado_en
        timestamptz cancelado_en
        timestamptz creado_en
    }

    intento_email {
        bigserial id PK
        bigint evento_id FK
        smallint numero
        varchar resultado
        text error
        timestamptz intentado_en
    }

    auditoria {
        bigserial id PK
        bigint actor_id FK
        varchar accion
        varchar entidad
        bigint referencia_id
        text detalle
        timestamptz creado_en
    }

    persona ||--o| usuario : "persona_id"
    persona ||--o| paciente : "persona_id"
    paciente |o--o{ paciente : "tutor_id"
    obra_social |o--o{ paciente : "obra_social_id"
    usuario ||--o| medico : "usuario_id"
    especialidad ||--o{ medico : "especialidad_id"
    usuario ||--o{ disponibilidad : "profesional_id"
    usuario |o--o{ disponibilidad : "suspendida_por"
    vacuna ||--o{ lote_vacuna : "vacuna_id"
    paciente ||--o{ turno : "paciente_id"
    disponibilidad ||--o{ turno : "disponibilidad_id"
    usuario ||--o{ turno : "creado_por"
    vacuna |o--o{ turno : "vacuna_id"
    lote_vacuna |o--o{ turno : "lote_reservado_id"
    obra_social |o--o{ turno : "obra_social_id"
    usuario |o--o{ turno : "cancelado_por"
    turno |o--o| turno : "reprogramado_desde_id"
    turno ||--o| consulta : "turno_id"
    medico ||--o{ consulta : "autor_id"
    consulta ||--o{ correccion : "consulta_turno_id"
    medico ||--o{ correccion : "autor_id"
    consulta ||--o{ adjunto : "consulta_turno_id"
    lote_vacuna ||--o{ movimiento_stock : "lote_id"
    turno |o--o| movimiento_stock : "turno_id"
    usuario ||--o{ movimiento_stock : "registrado_por"
    turno ||--o{ pago_manual : "turno_id"
    usuario ||--o{ pago_manual : "registrado_por"
    turno ||--o{ comprobante_turno : "turno_id"
    usuario ||--o{ comprobante_turno : "generado_por"
    usuario ||--o{ evento_email : "destinatario_id"
    turno |o--o{ evento_email : "turno_id"
    vacuna |o--o{ evento_email : "vacuna_id"
    evento_email ||--o{ intento_email : "evento_id"
    usuario |o--o{ auditoria : "actor_id"
