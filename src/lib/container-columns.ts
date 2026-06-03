export type ColumnKey =
  | "container_type"
  | "weight"
  | "mbl"
  | "container_no"
  | "terminal"
  | "customer"
  | "pickup_driver"
  | "return_driver"
  | "do_number"
  | "order_date"
  | "eta_date"
  | "operation_type"
  | "delivery_location"
  | "lfd_date"
  | "pickup_date"
  | "forecast_window"
  | "empty_report_date"
  | "return_date"
  | "appointment_no"
  | "appointment_time"
  | "warehouse_account"
  | "backend_delivery"
  | "appointment_colleague";

export type ColumnFilterType = "text" | "select" | "date" | "boolean";

export type DataColumn = {
  key: ColumnKey;
  label: string;
  filterType: ColumnFilterType;
  defaultWidth: number;
  sortable: boolean;
};

/** google_sheet 页面全部业务列（顺序与业务表一致） */
export const DATA_COLUMNS: DataColumn[] = [
  { key: "container_type", label: "柜型", filterType: "text", defaultWidth: 72, sortable: true },
  { key: "weight", label: "重量", filterType: "text", defaultWidth: 80, sortable: true },
  { key: "mbl", label: "MBL", filterType: "text", defaultWidth: 120, sortable: true },
  { key: "container_no", label: "柜号", filterType: "text", defaultWidth: 130, sortable: true },
  { key: "terminal", label: "码头/查验站", filterType: "text", defaultWidth: 100, sortable: true },
  { key: "customer", label: "客户", filterType: "text", defaultWidth: 100, sortable: true },
  { key: "pickup_driver", label: "提柜司机", filterType: "text", defaultWidth: 96, sortable: true },
  { key: "return_driver", label: "还柜司机", filterType: "text", defaultWidth: 96, sortable: true },
  { key: "do_number", label: "DO", filterType: "text", defaultWidth: 88, sortable: true },
  { key: "order_date", label: "订单日期", filterType: "date", defaultWidth: 108, sortable: true },
  { key: "eta_date", label: "ETA", filterType: "date", defaultWidth: 108, sortable: true },
  { key: "operation_type", label: "操作方式", filterType: "select", defaultWidth: 88, sortable: true },
  { key: "delivery_location", label: "送货地", filterType: "text", defaultWidth: 120, sortable: true },
  { key: "lfd_date", label: "LFD", filterType: "date", defaultWidth: 108, sortable: true },
  { key: "pickup_date", label: "提柜日期", filterType: "date", defaultWidth: 108, sortable: true },
  { key: "forecast_window", label: "预报窗口期", filterType: "text", defaultWidth: 100, sortable: true },
  { key: "empty_report_date", label: "报空日期", filterType: "date", defaultWidth: 108, sortable: true },
  { key: "return_date", label: "还柜日期", filterType: "date", defaultWidth: 108, sortable: true },
  { key: "appointment_no", label: "预约号码", filterType: "text", defaultWidth: 100, sortable: true },
  { key: "appointment_time", label: "预约时间", filterType: "date", defaultWidth: 140, sortable: true },
  { key: "warehouse_account", label: "约仓账号", filterType: "text", defaultWidth: 96, sortable: true },
  { key: "backend_delivery", label: "后端送", filterType: "boolean", defaultWidth: 72, sortable: true },
  { key: "appointment_colleague", label: "预约同事", filterType: "text", defaultWidth: 96, sortable: true },
];

export const DATE_COLUMN_KEYS: ColumnKey[] = [
  "order_date",
  "eta_date",
  "lfd_date",
  "pickup_date",
  "empty_report_date",
  "return_date",
];

export const COLUMN_ORDER_STORAGE_KEY = "gng-google-sheet-column-order";
export const COLUMN_WIDTH_STORAGE_KEY = "gng-google-sheet-column-widths";

export const SORTABLE_COLUMN_KEYS = DATA_COLUMNS.map((c) => c.key);

export function getDefaultColumnOrder(): ColumnKey[] {
  return DATA_COLUMNS.map((c) => c.key);
}

export function getDefaultColumnWidths(): Record<string, number> {
  return Object.fromEntries(DATA_COLUMNS.map((c) => [c.key, c.defaultWidth]));
}

export function isDateColumn(key: ColumnKey): boolean {
  return DATE_COLUMN_KEYS.includes(key) || key === "appointment_time";
}
