-- 解析模块 v2：attachments / batch_no / 审计字段

-- orders 审计字段
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by int8;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_by int8;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS remarks text;

-- containers 扩展字段
ALTER TABLE containers ADD COLUMN IF NOT EXISTS batch_no varchar(50);
ALTER TABLE containers ADD COLUMN IF NOT EXISTS customer varchar(200);
ALTER TABLE containers ADD COLUMN IF NOT EXISTS driver varchar(200);
ALTER TABLE containers ADD COLUMN IF NOT EXISTS order_date date;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS eta date;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS lfd date;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS pickup_date date;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS attachment_name text;

CREATE INDEX IF NOT EXISTS idx_containers_batch_no ON containers (batch_no);

-- attachments 表
CREATE TABLE IF NOT EXISTS attachments (
  id serial PRIMARY KEY,
  container_id int4 NOT NULL,
  container_no varchar(20) NOT NULL,
  batch_no varchar(50) NOT NULL,
  attachment_name text,
  parse_status varchar(30) DEFAULT 'pending',
  error_message text,
  created_at timestamp(6) DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_container_id ON attachments (container_id);
CREATE INDEX IF NOT EXISTS idx_attachments_batch_no ON attachments (batch_no);
CREATE INDEX IF NOT EXISTS idx_attachments_container_no ON attachments (container_no);

-- delivery_items 扩展
ALTER TABLE delivery_items ADD COLUMN IF NOT EXISTS attachment_id int4;
ALTER TABLE delivery_items ADD COLUMN IF NOT EXISTS container_id int4;
ALTER TABLE delivery_items ADD COLUMN IF NOT EXISTS batch_no varchar(50);

CREATE INDEX IF NOT EXISTS idx_delivery_items_attachment_id ON delivery_items (attachment_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_container_id ON delivery_items (container_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_batch_no ON delivery_items (batch_no);

-- parse_logs 扩展
ALTER TABLE parse_logs ADD COLUMN IF NOT EXISTS container_id int8;
ALTER TABLE parse_logs ADD COLUMN IF NOT EXISTS attachment_id int4;
ALTER TABLE parse_logs ADD COLUMN IF NOT EXISTS batch_no varchar(50);

CREATE INDEX IF NOT EXISTS idx_parse_logs_container_id ON parse_logs (container_id);
CREATE INDEX IF NOT EXISTS idx_parse_logs_batch_no ON parse_logs (batch_no);

-- warehouse_summaries 批次
ALTER TABLE warehouse_summaries ADD COLUMN IF NOT EXISTS batch_no varchar(50);

ALTER TABLE warehouse_summaries DROP CONSTRAINT IF EXISTS uk_warehouse_summaries_container_warehouse;
CREATE UNIQUE INDEX IF NOT EXISTS uk_warehouse_summaries_container_warehouse_batch
  ON warehouse_summaries (container_no, warehouse_code, batch_no);
