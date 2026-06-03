CREATE TABLE IF NOT EXISTS containers_history (
  id BIGSERIAL PRIMARY KEY,
  container_id BIGINT NOT NULL,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  operated_by BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_containers_history_container
    FOREIGN KEY (container_id) REFERENCES containers(id) ON DELETE CASCADE,
  CONSTRAINT fk_containers_history_operated_by
    FOREIGN KEY (operated_by) REFERENCES users(id) ON DELETE NO ACTION,
  CONSTRAINT uk_containers_history_container_version
    UNIQUE (container_id, version)
);

CREATE INDEX IF NOT EXISTS idx_containers_history_container_id
  ON containers_history (container_id);

CREATE INDEX IF NOT EXISTS idx_containers_history_created_at
  ON containers_history (created_at DESC);

COMMENT ON TABLE containers_history IS '集装箱记录版本历史';
COMMENT ON COLUMN containers_history.snapshot IS '更新前记录快照 JSON';
COMMENT ON COLUMN containers_history.container_id IS 'containers 主键';
COMMENT ON COLUMN containers_history.version IS '同一 container_id 递增版本号';
COMMENT ON COLUMN containers_history.operated_by IS '操作人 users.id';
