/**
 * PRD 5.3 数据库存储 — 四表说明
 *
 * | 表名                 | 说明           |
 * |----------------------|----------------|
 * | containers           | 柜号订单表     |
 * | delivery_items       | 派送明细表     |
 * | warehouse_summaries  | 仓库汇总表     |
 * | parse_logs           | 解析日志表     |
 *
 * 全量建表：npm run db:init-prd  （执行 prd_5_3_init.sql）
 * 增量迁移：prisma/sql/prd_5_3_migration.sql（仅 is_warning 字段）
 *
 * 字段映射（PRD → 现有库）：
 * - driver        → pickup_driver
 * - eta           → eta_date
 * - lfd           → lfd_date
 * - is_warning    → delivery_items.is_warning（PRD 5.3 新增）
 *
 * 详见 prisma/sql/schema.sql 与 prisma/schema.prisma
