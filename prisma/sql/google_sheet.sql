-- =============================================================================
-- google_sheet 表（Google Sheet 订单表 / 集装箱管理主表）
-- 字段来源：需求截图业务字段 + 审计字段
-- 执行：npm run db:google-sheet
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE operation_type AS ENUM ('整柜', '拆柜');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE parse_status AS ENUM ('pending', 'parsing', 'success', 'failed', 'partial_success');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 1. 若旧表 containers 存在且 google_sheet 不存在：重命名（保留数据）
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'containers'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'google_sheet'
  ) THEN
    ALTER TABLE containers RENAME TO google_sheet;
    ALTER INDEX IF EXISTS uk_containers_container_no RENAME TO uk_google_sheet_container_no;
    ALTER INDEX IF EXISTS idx_containers_created_at RENAME TO idx_google_sheet_created_at;
    ALTER INDEX IF EXISTS idx_containers_customer RENAME TO idx_google_sheet_customer;
    ALTER INDEX IF EXISTS idx_containers_eta_date RENAME TO idx_google_sheet_eta_date;
    ALTER INDEX IF EXISTS idx_containers_lfd_date RENAME TO idx_google_sheet_lfd_date;
    ALTER INDEX IF EXISTS idx_containers_parse_status RENAME TO idx_google_sheet_parse_status;
    ALTER INDEX IF EXISTS idx_containers_pickup_driver RENAME TO idx_google_sheet_pickup_driver;
    ALTER INDEX IF EXISTS idx_containers_terminal RENAME TO idx_google_sheet_terminal;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. 新建 google_sheet（空库时使用）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS google_sheet (
  id                    BIGSERIAL PRIMARY KEY,

  -- 截图表1：柜号 / 客户 / 基础信息
  container_type        VARCHAR(10)    NOT NULL DEFAULT '40',   -- 柜型
  weight                DECIMAL(12, 2),                         -- 重量
  mbl                   VARCHAR(50),                            -- MBL
  container_no          VARCHAR(20)    NOT NULL,                -- 柜号
  terminal              VARCHAR(50)    NOT NULL DEFAULT '-',   -- 码头/查验站
  customer              VARCHAR(100)   NOT NULL DEFAULT '-',   -- 客户

  -- 截图表2：物流 / 预约 / 操作
  pickup_driver         VARCHAR(50),                            -- 提柜司机
  return_driver         VARCHAR(50),                            -- 还柜司机
  do_number             VARCHAR(50),                            -- DO
  order_date            DATE,                                   -- 订单日期
  eta_date              DATE,                                   -- ETA
  operation_type        operation_type NOT NULL DEFAULT '整柜', -- 操作方式
  delivery_location     VARCHAR(200),                           -- 送货地
  lfd_date              DATE,                                   -- LFD
  pickup_date           DATE,                                   -- 提柜日期
  forecast_window       VARCHAR(50),                            -- 预报窗口期
  empty_report_date     DATE,                                   -- 报空日期
  return_date           DATE,                                   -- 还柜日期
  appointment_no        VARCHAR(50),                            -- 预约号码
  appointment_time      TIMESTAMPTZ,                            -- 预约时间
  warehouse_account     VARCHAR(50),                            -- 约仓账号
  backend_delivery      BOOLEAN        NOT NULL DEFAULT FALSE,  -- 后端送
  appointment_colleague VARCHAR(50),                            -- 预约同事
  remarks               TEXT,                                   -- 备注

  -- 截图2：审计 / 软删除 / 排序
  created_by            BIGINT         NOT NULL REFERENCES users(id),
  updated_by            BIGINT         REFERENCES users(id),
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,                            -- 软删除时间
  deleted_by            BIGINT         REFERENCES users(id),
  sort                  BIGINT,                                   -- 排序

  CONSTRAINT uk_google_sheet_container_no UNIQUE (container_no)
);

-- -----------------------------------------------------------------------------
-- 3. 增量补列（表已存在但缺字段时）
-- -----------------------------------------------------------------------------
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS container_type        VARCHAR(10)    NOT NULL DEFAULT '40';
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS weight                DECIMAL(12, 2);
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS mbl                   VARCHAR(50);
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS container_no          VARCHAR(20);
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS terminal              VARCHAR(50)    NOT NULL DEFAULT '-';
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS customer              VARCHAR(100)   NOT NULL DEFAULT '-';
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS pickup_driver         VARCHAR(50);
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS return_driver         VARCHAR(50);
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS do_number             VARCHAR(50);
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS order_date            DATE;
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS eta_date              DATE;
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS operation_type        operation_type NOT NULL DEFAULT '整柜';
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS delivery_location     VARCHAR(200);
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS lfd_date              DATE;
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS pickup_date           DATE;
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS forecast_window       VARCHAR(50);
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS empty_report_date     DATE;
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS return_date           DATE;
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS appointment_no        VARCHAR(50);
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS appointment_time      TIMESTAMPTZ;
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS warehouse_account     VARCHAR(50);
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS backend_delivery      BOOLEAN        NOT NULL DEFAULT FALSE;
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS appointment_colleague VARCHAR(50);
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS remarks               TEXT;
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS created_by            BIGINT;
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS updated_by            BIGINT;
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW();
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW();
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS deleted_at            TIMESTAMPTZ;
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS deleted_by            BIGINT;
ALTER TABLE google_sheet ADD COLUMN IF NOT EXISTS sort                  BIGINT;

COMMENT ON COLUMN google_sheet.deleted_at IS '软删除时间';
COMMENT ON COLUMN google_sheet.sort IS '排序';

-- -----------------------------------------------------------------------------
-- 4. 索引
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uk_google_sheet_container_no ON google_sheet (container_no);
CREATE INDEX IF NOT EXISTS idx_google_sheet_created_at ON google_sheet (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_google_sheet_customer ON google_sheet (customer);
CREATE INDEX IF NOT EXISTS idx_google_sheet_eta_date ON google_sheet (eta_date);
CREATE INDEX IF NOT EXISTS idx_google_sheet_lfd_date ON google_sheet (lfd_date);
CREATE INDEX IF NOT EXISTS idx_google_sheet_terminal ON google_sheet (terminal);
CREATE INDEX IF NOT EXISTS idx_google_sheet_pickup_driver ON google_sheet (pickup_driver);
CREATE INDEX IF NOT EXISTS idx_google_sheet_sort ON google_sheet (sort) WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- 5. 外键：解析子表指向 google_sheet.container_no
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'delivery_items') THEN
    ALTER TABLE delivery_items DROP CONSTRAINT IF EXISTS fk_delivery_items_container;
    ALTER TABLE delivery_items DROP CONSTRAINT IF EXISTS delivery_items_container_no_fkey;
    ALTER TABLE delivery_items
      ADD CONSTRAINT fk_delivery_items_google_sheet
      FOREIGN KEY (container_no) REFERENCES google_sheet (container_no) ON DELETE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'warehouse_summaries') THEN
    ALTER TABLE warehouse_summaries DROP CONSTRAINT IF EXISTS fk_warehouse_summaries_container;
    ALTER TABLE warehouse_summaries DROP CONSTRAINT IF EXISTS warehouse_summaries_container_no_fkey;
    ALTER TABLE warehouse_summaries
      ADD CONSTRAINT fk_warehouse_summaries_google_sheet
      FOREIGN KEY (container_no) REFERENCES google_sheet (container_no) ON DELETE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'parse_logs') THEN
    ALTER TABLE parse_logs DROP CONSTRAINT IF EXISTS fk_parse_logs_container;
    ALTER TABLE parse_logs DROP CONSTRAINT IF EXISTS parse_logs_container_no_fkey;
    ALTER TABLE parse_logs
      ADD CONSTRAINT fk_parse_logs_google_sheet
      FOREIGN KEY (container_no) REFERENCES google_sheet (container_no) ON DELETE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'google_sheet_history') THEN
    ALTER TABLE google_sheet_history DROP CONSTRAINT IF EXISTS fk_containers_history_container;
    ALTER TABLE google_sheet_history DROP CONSTRAINT IF EXISTS fk_google_sheet_history;
    ALTER TABLE google_sheet_history DROP CONSTRAINT IF EXISTS google_sheet_history_container_id_fkey;
    ALTER TABLE google_sheet_history DROP CONSTRAINT IF EXISTS containers_history_container_id_fkey;
    ALTER TABLE google_sheet_history
      ADD CONSTRAINT fk_google_sheet_history_sheet
      FOREIGN KEY (container_id) REFERENCES google_sheet (id) ON DELETE CASCADE;
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'containers_history') THEN
    ALTER TABLE containers_history DROP CONSTRAINT IF EXISTS fk_containers_history_container;
    ALTER TABLE containers_history DROP CONSTRAINT IF EXISTS containers_history_container_id_fkey;
    ALTER TABLE containers_history
      ADD CONSTRAINT fk_google_sheet_history_sheet
      FOREIGN KEY (container_id) REFERENCES google_sheet (id) ON DELETE CASCADE;
  END IF;
END $$;
