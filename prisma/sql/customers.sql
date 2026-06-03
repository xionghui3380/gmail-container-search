-- 客户表（单表 CRUD 示例）
-- 用于教学目的，展示一个完整的单表增删改查

CREATE TABLE IF NOT EXISTS customers (
  id          BIGSERIAL    PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  contact     VARCHAR(50),
  phone       VARCHAR(20),
  email       VARCHAR(100),
  address     VARCHAR(200),
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  remarks     TEXT,
  created_by  BIGINT       NOT NULL REFERENCES users(id) ON DELETE NO ACTION,
  updated_by  BIGINT       REFERENCES users(id) ON DELETE NO ACTION,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at DESC);

COMMENT ON TABLE customers IS '客户信息表';
COMMENT ON COLUMN customers.id IS '主键';
COMMENT ON COLUMN customers.name IS '客户名称';
COMMENT ON COLUMN customers.contact IS '联系人';
COMMENT ON COLUMN customers.phone IS '联系电话';
COMMENT ON COLUMN customers.email IS '邮箱';
COMMENT ON COLUMN customers.address IS '地址';
COMMENT ON COLUMN customers.is_active IS '是否启用';
COMMENT ON COLUMN customers.remarks IS '备注';
COMMENT ON COLUMN customers.created_by IS '创建人 users.id';
COMMENT ON COLUMN customers.updated_by IS '更新人 users.id';
COMMENT ON COLUMN customers.created_at IS '创建时间';
COMMENT ON COLUMN customers.updated_at IS '更新时间';
COMMENT ON COLUMN customers.deleted_at IS '软删除时间（非 NULL 表示已删除）';
