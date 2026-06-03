-- 订单表 orders
CREATE TABLE IF NOT EXISTS orders (
  id             SERIAL PRIMARY KEY,
  container_no   VARCHAR(20)  NOT NULL,
  operation_type VARCHAR(50),
  customer       VARCHAR(200),
  order_date     DATE,
  eta            DATE,
  pickup_date    DATE,
  created_at     TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_container_no ON orders (container_no);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);

COMMENT ON TABLE orders IS '订单表，每行代表一个柜号订单';
COMMENT ON COLUMN orders.id IS '自增主键';
COMMENT ON COLUMN orders.container_no IS '柜号';
COMMENT ON COLUMN orders.operation_type IS '操作方式，如拆柜';
COMMENT ON COLUMN orders.customer IS '客户';
COMMENT ON COLUMN orders.order_date IS '订单日期';
COMMENT ON COLUMN orders.eta IS 'ETA';
COMMENT ON COLUMN orders.pickup_date IS '提柜日期';
COMMENT ON COLUMN orders.created_at IS '创建时间';
COMMENT ON COLUMN orders.updated_at IS '更新时间';
