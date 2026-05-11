-- Schema principal — contador-demo
-- Ejecutar con: psql $DATABASE_URL -f db/schema.sql

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Usuarios (contadores / admins del panel) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL,
  email         VARCHAR(120) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol           VARCHAR(20)  NOT NULL DEFAULT 'contador',
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Tickets (potenciales clientes — pre-venta) ───────────────────────────────
CREATE TABLE IF NOT EXISTS tickets (
  id                  SERIAL PRIMARY KEY,
  nombre              VARCHAR(120),
  telefono            VARCHAR(20)  NOT NULL,
  rut                 VARCHAR(15),
  servicio_consultado VARCHAR(100),
  info_recopilada     JSONB        NOT NULL DEFAULT '{}',
  estado              VARCHAR(20)  NOT NULL DEFAULT 'pendiente', -- pendiente | aprobado | rechazado
  contador_id         INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_resolucion    TIMESTAMPTZ
);

-- ─── Clientes ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id              SERIAL PRIMARY KEY,
  telefono        VARCHAR(20)  UNIQUE NOT NULL,   -- identificador principal
  rut             VARCHAR(15)  UNIQUE,             -- identificador secundario
  nombre          VARCHAR(120) NOT NULL,
  email           VARCHAR(120),
  tipo            VARCHAR(20)  NOT NULL DEFAULT 'individual', -- individual | empresa
  nombre_empresa  VARCHAR(150),
  estado          VARCHAR(20)  NOT NULL DEFAULT 'activo',     -- activo | inactivo
  bot_activo      BOOLEAN      NOT NULL DEFAULT TRUE,
  modulos_activos JSONB        NOT NULL DEFAULT '{"preventa":true,"onboarding":true,"consulta_proceso":true,"notificaciones":true}',
  password_hash   VARCHAR(255),                   -- para acceso al portal (solo tipo empresa)
  contador_id     INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_registro  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_telefono ON clientes(telefono);
CREATE INDEX IF NOT EXISTS idx_clientes_rut      ON clientes(rut);

-- ─── Procesos ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS procesos (
  id              SERIAL PRIMARY KEY,
  cliente_id      INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo            VARCHAR(100) NOT NULL,
  estado          VARCHAR(30)  NOT NULL DEFAULT 'abierto', -- abierto | en_proceso | completado | cancelado
  etapa_actual    INTEGER      NOT NULL DEFAULT 1,
  total_etapas    INTEGER      NOT NULL DEFAULT 1,
  notas           TEXT,
  fecha_inicio    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_estimada  TIMESTAMPTZ,
  fecha_cierre    TIMESTAMPTZ,
  contador_id     INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_procesos_cliente ON procesos(cliente_id);

-- ─── Etapas de proceso ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS etapas (
  id               SERIAL PRIMARY KEY,
  proceso_id       INTEGER NOT NULL REFERENCES procesos(id) ON DELETE CASCADE,
  nombre           VARCHAR(120) NOT NULL,
  descripcion      TEXT,
  estado           VARCHAR(20)  NOT NULL DEFAULT 'pendiente', -- pendiente | en_curso | completada
  orden            INTEGER      NOT NULL,
  fecha_completado TIMESTAMPTZ
);

-- ─── Documentos ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documentos (
  id              SERIAL PRIMARY KEY,
  proceso_id      INTEGER REFERENCES procesos(id) ON DELETE SET NULL,
  cliente_id      INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre          VARCHAR(255) NOT NULL,
  nombre_original VARCHAR(255),
  path            VARCHAR(500) NOT NULL,
  tipo_mime       VARCHAR(100),
  tipo_doc        VARCHAR(50)  DEFAULT 'otro', -- boleta | factura | contrato | resultado | otro
  direccion       VARCHAR(10)  NOT NULL DEFAULT 'entrante', -- entrante | saliente
  fecha_recibido  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  eliminado_en    TIMESTAMPTZ   -- null = archivo existe; fecha = eliminado físicamente
);

CREATE INDEX IF NOT EXISTS idx_documentos_cliente ON documentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_documentos_proceso ON documentos(proceso_id);

-- ─── Mensajes (log WhatsApp) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mensajes (
  id          SERIAL PRIMARY KEY,
  cliente_id  INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  telefono    VARCHAR(20) NOT NULL,
  direccion   VARCHAR(10) NOT NULL, -- entrante | saliente
  tipo        VARCHAR(20) NOT NULL DEFAULT 'texto', -- texto | imagen | documento | audio
  contenido   TEXT,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mensajes_cliente   ON mensajes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_timestamp ON mensajes(timestamp);

-- ─── Configuración de onboarding por instalación ─────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_config (
  id                  SERIAL PRIMARY KEY,
  contador_id         INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  steps               JSONB NOT NULL,
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
