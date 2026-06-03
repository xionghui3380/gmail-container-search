-- 修复 google_sheet / containers 主键 id 缺少自增序列（P2011: Null constraint violation on id）

DO $$
DECLARE
  max_id BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'google_sheet'
  ) AND pg_get_serial_sequence('google_sheet', 'id') IS NULL THEN
    CREATE SEQUENCE IF NOT EXISTS google_sheet_id_seq;
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM google_sheet;
    IF max_id = 0 THEN
      PERFORM setval('google_sheet_id_seq', 1, false);
    ELSE
      PERFORM setval('google_sheet_id_seq', max_id, true);
    END IF;
    ALTER TABLE google_sheet
      ALTER COLUMN id SET DEFAULT nextval('google_sheet_id_seq');
    ALTER SEQUENCE google_sheet_id_seq OWNED BY google_sheet.id;
  END IF;
END $$;

DO $$
DECLARE
  max_id BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'containers'
  ) AND pg_get_serial_sequence('containers', 'id') IS NULL THEN
    CREATE SEQUENCE IF NOT EXISTS containers_id_seq;
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM containers;
    IF max_id = 0 THEN
      PERFORM setval('containers_id_seq', 1, false);
    ELSE
      PERFORM setval('containers_id_seq', max_id, true);
    END IF;
    ALTER TABLE containers
      ALTER COLUMN id SET DEFAULT nextval('containers_id_seq');
    ALTER SEQUENCE containers_id_seq OWNED BY containers.id;
  END IF;
END $$;
