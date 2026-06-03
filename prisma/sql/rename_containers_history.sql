-- 将历史表统一为 google_sheet_history（支持旧名与拼写错误表名）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'google_shee_history'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'google_sheet_history'
  ) THEN
    ALTER TABLE google_shee_history RENAME TO google_sheet_history;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'containers_history'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'google_sheet_history'
  ) THEN
    ALTER TABLE containers_history RENAME TO google_sheet_history;
  END IF;
END $$;

-- 重命名索引（若存在旧名称）
ALTER INDEX IF EXISTS uk_containers_history_container_version
  RENAME TO uk_google_sheet_history_container_version;
ALTER INDEX IF EXISTS idx_containers_history_container_id
  RENAME TO idx_google_sheet_history_container_id;
ALTER INDEX IF EXISTS idx_containers_history_created_at
  RENAME TO idx_google_sheet_history_created_at;
