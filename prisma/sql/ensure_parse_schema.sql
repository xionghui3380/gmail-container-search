-- 确保解析模块所需表结构完整（可重复执行）

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

-- containers 新字段（若表由旧结构迁移而来，删除不存在的列引用依赖这些字段）
ALTER TABLE containers ADD COLUMN IF NOT EXISTS order_id int4;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS batch_no varchar(50);
ALTER TABLE containers ADD COLUMN IF NOT EXISTS customer varchar(200);
ALTER TABLE containers ADD COLUMN IF NOT EXISTS driver varchar(200);
ALTER TABLE containers ADD COLUMN IF NOT EXISTS order_date date;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS eta date;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS lfd date;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS pickup_date date;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS attachment_name text;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS email_message_id text;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS email_subject text;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS email_from varchar(200);
ALTER TABLE containers ADD COLUMN IF NOT EXISTS email_date timestamp(6);
ALTER TABLE containers ADD COLUMN IF NOT EXISTS parse_status varchar(30) DEFAULT 'pending';
ALTER TABLE containers ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS created_at timestamp(6) DEFAULT now();
ALTER TABLE containers ADD COLUMN IF NOT EXISTS updated_at timestamp(6) DEFAULT now();

-- delivery_items 扩展列
ALTER TABLE delivery_items ADD COLUMN IF NOT EXISTS attachment_id int4;
ALTER TABLE delivery_items ADD COLUMN IF NOT EXISTS container_id int4;
ALTER TABLE delivery_items ADD COLUMN IF NOT EXISTS batch_no varchar(50);

-- parse_logs 扩展列
ALTER TABLE parse_logs ADD COLUMN IF NOT EXISTS container_id int8;
ALTER TABLE parse_logs ADD COLUMN IF NOT EXISTS attachment_id int4;
ALTER TABLE parse_logs ADD COLUMN IF NOT EXISTS batch_no varchar(50);

-- warehouse_summaries 批次
ALTER TABLE warehouse_summaries ADD COLUMN IF NOT EXISTS batch_no varchar(50);
ALTER TABLE warehouse_summaries DROP CONSTRAINT IF EXISTS uk_warehouse_summaries_container_warehouse;
DROP INDEX IF EXISTS uk_warehouse_summaries_container_warehouse;
CREATE UNIQUE INDEX IF NOT EXISTS uk_warehouse_summaries_container_warehouse_batch
  ON warehouse_summaries (container_no, warehouse_code, batch_no);
