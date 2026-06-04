-- 客户表 customers
CREATE TABLE IF NOT EXISTS customers (
  id          BIGSERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  contact     VARCHAR(50),
  phone       VARCHAR(20),
  email       VARCHAR(100),
  address     VARCHAR(200),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  remarks     TEXT,
  created_by  BIGINT NOT NULL,
  updated_by  BIGINT,
  created_at  TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ(6)
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (name);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers (created_at DESC);

COMMENT ON TABLE customers IS '客户主数据';
