/**
 * 全量建表 SQL（PostgreSQL）
 * 与 prisma/schema.prisma 保持一致，可用于全新环境初始化。
 * 若已通过 Prisma migrate 建库，无需重复执行。
 */

CREATE TYPE user_role AS ENUM ('admin', 'operator', 'viewer');
CREATE TYPE operation_type AS ENUM ('整柜', '拆柜');
CREATE TYPE parse_status AS ENUM ('pending', 'parsing', 'success', 'failed', 'partial_success');
CREATE TYPE log_status AS ENUM ('success', 'failed', 'warning');

CREATE TABLE users (
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

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_enabled ON users(is_enabled);

CREATE TABLE containers (
  id                   BIGSERIAL PRIMARY KEY,
  container_type       VARCHAR(10)   NOT NULL DEFAULT '40',
  weight               DECIMAL(12, 2),
  mbl                  VARCHAR(50),
  vessel_name          VARCHAR(30),
  voyage_no            VARCHAR(30),
  terminal             VARCHAR(50)   NOT NULL,
  customer             VARCHAR(100)  NOT NULL,
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
  created_by           BIGINT        NOT NULL REFERENCES users(id),
  updated_by           BIGINT REFERENCES users(id),
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ,
  deleted_by           BIGINT REFERENCES users(id),
  sort                 BIGINT
);

CREATE INDEX idx_containers_created_at ON containers(created_at DESC);
CREATE INDEX idx_containers_customer ON containers(customer);
CREATE INDEX idx_containers_eta_date ON containers(eta_date);
CREATE INDEX idx_containers_lfd_date ON containers(lfd_date);
CREATE INDEX idx_containers_parse_status ON containers(parse_status);
CREATE INDEX idx_containers_pickup_driver ON containers(pickup_driver);
CREATE INDEX idx_containers_terminal ON containers(terminal);

CREATE TABLE containers_history (
  id           BIGSERIAL PRIMARY KEY,
  container_id BIGINT      NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  version      INT         NOT NULL,
  snapshot     JSONB       NOT NULL,
  operated_by  BIGINT      NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_containers_history_container_version UNIQUE (container_id, version)
);

CREATE INDEX idx_containers_history_container_id ON containers_history(container_id);
CREATE INDEX idx_containers_history_created_at ON containers_history(created_at DESC);

CREATE TABLE delivery_items (
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
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_delivery_items_container_no ON delivery_items(container_no);
CREATE INDEX idx_delivery_items_fba_id ON delivery_items(fba_id);
CREATE INDEX idx_delivery_items_warehouse_code ON delivery_items(warehouse_code);

CREATE TABLE warehouse_summaries (
  id             BIGSERIAL PRIMARY KEY,
  container_no   VARCHAR(20) NOT NULL REFERENCES containers(container_no) ON DELETE CASCADE,
  warehouse_code VARCHAR(50) NOT NULL,
  total_cartons  INT         NOT NULL DEFAULT 0,
  item_count     INT         NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_warehouse_summaries_container_warehouse UNIQUE (container_no, warehouse_code)
);

CREATE INDEX idx_warehouse_summaries_container_no ON warehouse_summaries(container_no);

CREATE TABLE parse_logs (
  id           BIGSERIAL PRIMARY KEY,
  container_no VARCHAR(20) NOT NULL REFERENCES containers(container_no) ON DELETE CASCADE,
  step         VARCHAR(50) NOT NULL,
  status       log_status  NOT NULL,
  message      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_parse_logs_container_no ON parse_logs(container_no);
CREATE INDEX idx_parse_logs_created_at ON parse_logs(created_at DESC);
CREATE INDEX idx_parse_logs_status ON parse_logs(status);

CREATE TABLE customers (
  id          BIGSERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  contact     VARCHAR(50),
  phone       VARCHAR(20),
  email       VARCHAR(100),
  address     VARCHAR(200),
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  remarks     TEXT,
  created_by  BIGINT      NOT NULL REFERENCES users(id),
  updated_by  BIGINT REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_created_at ON customers(created_at DESC);
