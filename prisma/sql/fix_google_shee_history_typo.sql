-- 修正历史表拼写：google_shee_history → google_sheet_history
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
  END IF;
END $$;

-- 若仍为旧表名 containers_history
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'containers_history'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'google_sheet_history'
  ) THEN
    ALTER TABLE containers_history RENAME TO google_sheet_history;
  END IF;
END $$;

ALTER INDEX IF EXISTS uk_containers_history_container_version
  RENAME TO uk_google_sheet_history_container_version;
ALTER INDEX IF EXISTS idx_containers_history_container_id
  RENAME TO idx_google_sheet_history_container_id;
ALTER INDEX IF EXISTS idx_containers_history_created_at
  RENAME TO idx_google_sheet_history_created_at;
