-- google_sheet 版本历史表
CREATE TABLE IF NOT EXISTS google_sheet_history (
  id           BIGSERIAL PRIMARY KEY,
  container_id BIGINT NOT NULL,
  version      INT NOT NULL,
  snapshot     JSONB NOT NULL,
  operated_by  BIGINT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_google_sheet_history_sheet
    FOREIGN KEY (container_id) REFERENCES google_sheet(id) ON DELETE CASCADE,
  CONSTRAINT fk_google_sheet_history_operated_by
    FOREIGN KEY (operated_by) REFERENCES users(id),
  CONSTRAINT uk_google_sheet_history_container_version
    UNIQUE (container_id, version)
);

CREATE INDEX IF NOT EXISTS idx_google_sheet_history_container_id
  ON google_sheet_history (container_id);

CREATE INDEX IF NOT EXISTS idx_google_sheet_history_created_at
  ON google_sheet_history (created_at DESC);

COMMENT ON TABLE google_sheet_history IS 'Google Sheet 订单版本历史';
COMMENT ON COLUMN google_sheet_history.snapshot IS '更新前记录快照 JSON';
COMMENT ON COLUMN google_sheet_history.container_id IS 'google_sheet 主键';
COMMENT ON COLUMN google_sheet_history.version IS '同一 container_id 递增版本号';
COMMENT ON COLUMN google_sheet_history.operated_by IS '操作人 users.id';

-- 若库中仍为旧表名 containers_history，可执行：
-- ALTER TABLE containers_history RENAME TO google_sheet_history;
