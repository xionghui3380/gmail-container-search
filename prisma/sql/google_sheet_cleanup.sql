-- google_sheet 字段清理：移除解析/邮件扩展列及旧 containers 遗留列
-- 解析状态迁移至 container_parse_meta 表
-- 执行：npm run db:google-sheet-cleanup

DO $$ BEGIN
  CREATE TYPE parse_status AS ENUM ('pending', 'parsing', 'success', 'failed', 'partial_success');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1. 解析元数据表（与 google_sheet 1:1，按柜号）
CREATE TABLE IF NOT EXISTS container_parse_meta (
  container_no      VARCHAR(20)  PRIMARY KEY REFERENCES google_sheet (container_no) ON DELETE CASCADE,
  email_message_id  VARCHAR(128),
  email_subject     VARCHAR(500),
  email_from        VARCHAR(255),
  email_date        TIMESTAMPTZ,
  attachment_name   VARCHAR(255),
  parse_status      parse_status NOT NULL DEFAULT 'pending',
  error_message     TEXT,
  is_correct        BOOLEAN      NOT NULL DEFAULT TRUE,
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_container_parse_meta_status ON container_parse_meta (parse_status);

-- 2. 从 google_sheet 迁移已有解析数据
INSERT INTO container_parse_meta (
  container_no,
  email_message_id,
  email_subject,
  email_from,
  email_date,
  attachment_name,
  parse_status,
  error_message,
  is_correct,
  updated_at
)
SELECT
  container_no,
  email_message_id,
  email_subject,
  email_from,
  email_date,
  attachment_name,
  COALESCE(parse_status, 'pending'::parse_status),
  error_message,
  COALESCE(is_correct, TRUE),
  COALESCE(updated_at, NOW())
FROM google_sheet
WHERE container_no IS NOT NULL
ON CONFLICT (container_no) DO UPDATE SET
  email_message_id = EXCLUDED.email_message_id,
  email_subject    = EXCLUDED.email_subject,
  email_from       = EXCLUDED.email_from,
  email_date       = EXCLUDED.email_date,
  attachment_name  = EXCLUDED.attachment_name,
  parse_status     = EXCLUDED.parse_status,
  error_message    = EXCLUDED.error_message,
  is_correct       = EXCLUDED.is_correct,
  updated_at       = EXCLUDED.updated_at;

-- 3. 删除 google_sheet 无效/遗留列
ALTER TABLE google_sheet DROP COLUMN IF EXISTS email_message_id;
ALTER TABLE google_sheet DROP COLUMN IF EXISTS email_subject;
ALTER TABLE google_sheet DROP COLUMN IF EXISTS email_from;
ALTER TABLE google_sheet DROP COLUMN IF EXISTS email_date;
ALTER TABLE google_sheet DROP COLUMN IF EXISTS attachment_name;
ALTER TABLE google_sheet DROP COLUMN IF EXISTS parse_status;
ALTER TABLE google_sheet DROP COLUMN IF EXISTS error_message;
ALTER TABLE google_sheet DROP COLUMN IF EXISTS is_correct;
ALTER TABLE google_sheet DROP COLUMN IF EXISTS vessel_name;
ALTER TABLE google_sheet DROP COLUMN IF EXISTS voyage_no;
ALTER TABLE google_sheet DROP COLUMN IF EXISTS pickup_company;
ALTER TABLE google_sheet DROP COLUMN IF EXISTS return_company;
ALTER TABLE google_sheet DROP COLUMN IF EXISTS transport_date;

DROP INDEX IF EXISTS idx_google_sheet_parse_status;
DROP INDEX IF EXISTS idx_containers_parse_status;
