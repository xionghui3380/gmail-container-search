-- 货柜子表 FK 从 google_sheet 改指向 containers，并从 google_sheet 同步货柜主数据

-- 1. 从 google_sheet 同步到 containers（按柜号 upsert）
INSERT INTO containers (
  container_type, weight, mbl, terminal, customer, container_no,
  do_number, order_date, eta_date, operation_type, delivery_location,
  lfd_date, pickup_date, forecast_window, empty_report_date, return_date,
  appointment_no, appointment_time, warehouse_account, pickup_driver, return_driver,
  backend_delivery, appointment_colleague, is_correct, remarks,
  created_by, updated_by, created_at, updated_at, deleted_at, deleted_by, sort
)
SELECT
  g.container_type, g.weight, g.mbl, g.terminal, g.customer, g.container_no,
  g.do_number, g.order_date, g.eta_date, g.operation_type, g.delivery_location,
  g.lfd_date, g.pickup_date, g.forecast_window, g.empty_report_date, g.return_date,
  g.appointment_no, g.appointment_time, g.warehouse_account, g.pickup_driver, g.return_driver,
  g.backend_delivery, g.appointment_colleague, TRUE, g.remarks,
  g.created_by, g.updated_by, g.created_at, g.updated_at, g.deleted_at, g.deleted_by, g.sort
FROM google_sheet g
WHERE NOT EXISTS (
  SELECT 1 FROM containers c WHERE c.container_no = g.container_no
);

-- 同步解析元数据（若存在 container_parse_meta）
UPDATE containers c
SET
  email_message_id = m.email_message_id,
  email_subject = m.email_subject,
  email_from = m.email_from,
  email_date = m.email_date,
  attachment_name = m.attachment_name,
  parse_status = m.parse_status,
  error_message = m.error_message,
  is_correct = m.is_correct,
  updated_at = GREATEST(c.updated_at, m.updated_at)
FROM container_parse_meta m
WHERE c.container_no = m.container_no;

-- 2. 子表 FK 改指向 containers
ALTER TABLE delivery_items DROP CONSTRAINT IF EXISTS fk_delivery_items_google_sheet;
ALTER TABLE delivery_items DROP CONSTRAINT IF EXISTS delivery_items_container_no_fkey;

ALTER TABLE warehouse_summaries DROP CONSTRAINT IF EXISTS fk_warehouse_summaries_google_sheet;
ALTER TABLE warehouse_summaries DROP CONSTRAINT IF EXISTS warehouse_summaries_container_no_fkey;

ALTER TABLE parse_logs DROP CONSTRAINT IF EXISTS fk_parse_logs_google_sheet;
ALTER TABLE parse_logs DROP CONSTRAINT IF EXISTS parse_logs_container_no_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_delivery_items_containers'
  ) THEN
    ALTER TABLE delivery_items
      ADD CONSTRAINT fk_delivery_items_containers
      FOREIGN KEY (container_no) REFERENCES containers(container_no) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_warehouse_summaries_containers'
  ) THEN
    ALTER TABLE warehouse_summaries
      ADD CONSTRAINT fk_warehouse_summaries_containers
      FOREIGN KEY (container_no) REFERENCES containers(container_no) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_parse_logs_containers'
  ) THEN
    ALTER TABLE parse_logs
      ADD CONSTRAINT fk_parse_logs_containers
      FOREIGN KEY (container_no) REFERENCES containers(container_no) ON DELETE CASCADE;
  END IF;
END $$;
