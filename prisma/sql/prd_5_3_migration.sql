-- PRD 5.3 增量迁移（在已有 gmg 库上执行）
-- 新增 delivery_items.is_warning 异常标记字段

ALTER TABLE delivery_items
  ADD COLUMN IF NOT EXISTS is_warning BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN delivery_items.is_warning IS 'PRD 5.3：仓库代码为空或箱数异常时标记';

CREATE INDEX IF NOT EXISTS idx_delivery_items_is_warning
  ON delivery_items (container_no, is_warning)
  WHERE is_warning = TRUE;
