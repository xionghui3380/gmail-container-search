-- PRD 5.3 全量建表（四表 + users 最小依赖）
-- 适用于空库或仅缺解析相关表的环境

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'operator', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE operation_type AS ENUM ('整柜', '拆柜');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE parse_status AS ENUM ('pending', 'parsing', 'success', 'failed', 'partial_success');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE log_status AS ENUM ('success', 'failed', 'warning');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id              BIGSERIAL PRIMARY KEY,
  username        VARCHAR(50)  NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  full_name       VARCHAR(100) NOT NULL,
  phone           VARCHAR(20),
  email           VARCHAR(100) NOT NULL UNIQUE,
  role            user_role    NOT NULL DEFAULT 'operator',
  is_enabled      BOOLEAN      NOT NULL DEFAULT TRUE,
  clerk_user_id   VARCHAR(64)  UNIQUE,
  created_by      BIGINT REFERENCES users(id),
  updated_by      BIGINT REFERENCES users(id),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  remarks         TEXT
);

CREATE TABLE IF NOT EXISTS containers (
  id                   BIGSERIAL PRIMARY KEY,
  container_type       VARCHAR(10)   NOT NULL DEFAULT '40',
  weight               DECIMAL(12, 2),
  mbl                  VARCHAR(50),
  vessel_name          VARCHAR(30),
  voyage_no            VARCHAR(30),
  terminal             VARCHAR(50)   NOT NULL DEFAULT '-',
  customer             VARCHAR(100)  NOT NULL DEFAULT '-',
  container_no         VARCHAR(20)   NOT NULL UNIQUE,
  pickup_company       VARCHAR(100),
  return_company       VARCHAR(100),
  do_number            VARCHAR(50),
  order_date           DATE,
  eta_date             DATE,
  operation_type       operation_type NOT NULL DEFAULT '整柜',
  delivery_location    VARCHAR(200),
  lfd_date             DATE,
  pickup_date          DATE,
  forecast_window      VARCHAR(50),
  empty_report_date    DATE,
  return_date          DATE,
  transport_date       DATE,
  appointment_no       VARCHAR(50),
  appointment_time     TIMESTAMPTZ,
  warehouse_account    VARCHAR(50),
  pickup_driver        VARCHAR(50),
  return_driver        VARCHAR(50),
  backend_delivery     BOOLEAN       NOT NULL DEFAULT FALSE,
  appointment_colleague VARCHAR(50),
  is_correct           BOOLEAN       NOT NULL DEFAULT TRUE,
  remarks              TEXT,
  email_message_id     VARCHAR(128),
  email_subject        VARCHAR(500),
  email_from           VARCHAR(255),
  email_date           TIMESTAMPTZ,
  attachment_name      VARCHAR(255),
  parse_status         parse_status  NOT NULL DEFAULT 'pending',
  error_message        TEXT,
  created_by           BIGINT        NOT NULL REFERENCES users(id) DEFAULT 1,
  updated_by           BIGINT REFERENCES users(id),
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ,
  deleted_by           BIGINT REFERENCES users(id),
  sort                 BIGINT
);

CREATE TABLE IF NOT EXISTS delivery_items (
  id                  BIGSERIAL PRIMARY KEY,
  container_no        VARCHAR(20) NOT NULL REFERENCES containers(container_no) ON DELETE CASCADE,
  customer_code       VARCHAR(50),
  fba_id              VARCHAR(100),
  reference_id        VARCHAR(100),
  cbm                 DECIMAL(10, 2),
  weight              DECIMAL(10, 2),
  carton_count        INT,
  warehouse_code      VARCHAR(50),
  delivery_method     VARCHAR(50),
  customer_note       TEXT,
  actual_carton_count INT,
  pallet_count        INT,
  warehouse_note      TEXT,
  is_warning          BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse_summaries (
  id             BIGSERIAL PRIMARY KEY,
  container_no   VARCHAR(20) NOT NULL REFERENCES containers(container_no) ON DELETE CASCADE,
  warehouse_code VARCHAR(50) NOT NULL,
  total_cartons  INT         NOT NULL DEFAULT 0,
  item_count     INT         NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_warehouse_summaries_container_warehouse UNIQUE (container_no, warehouse_code)
);

CREATE TABLE IF NOT EXISTS parse_logs (
  id           BIGSERIAL PRIMARY KEY,
  container_no VARCHAR(20) NOT NULL REFERENCES containers(container_no) ON DELETE CASCADE,
  step         VARCHAR(100) NOT NULL,
  status       log_status  NOT NULL,
  message      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_items_container_no ON delivery_items(container_no);
CREATE INDEX IF NOT EXISTS idx_delivery_items_fba_id ON delivery_items(fba_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_warehouse_code ON delivery_items(warehouse_code);
CREATE INDEX IF NOT EXISTS idx_delivery_items_is_warning ON delivery_items(container_no, is_warning) WHERE is_warning = TRUE;
CREATE INDEX IF NOT EXISTS idx_warehouse_summaries_container_no ON warehouse_summaries(container_no);
CREATE INDEX IF NOT EXISTS idx_parse_logs_container_no ON parse_logs(container_no);
CREATE INDEX IF NOT EXISTS idx_parse_logs_created_at ON parse_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_containers_parse_status ON containers(parse_status);
CREATE INDEX IF NOT EXISTS idx_containers_container_no ON containers(container_no);

-- 若 delivery_items 已存在但缺 is_warning
ALTER TABLE delivery_items ADD COLUMN IF NOT EXISTS is_warning BOOLEAN NOT NULL DEFAULT FALSE;
