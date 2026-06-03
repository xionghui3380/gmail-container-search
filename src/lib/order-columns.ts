export type OrderColumnKey =
  | "container_no"
  | "operation_type"
  | "customer"
  | "order_date"
  | "eta"
  | "pickup_date";

export type OrderDataColumn = {
  key: OrderColumnKey;
  label: string;
  defaultWidth: number;
  sortable: boolean;
};

export const ORDER_COLUMNS: OrderDataColumn[] = [
  { key: "container_no", label: "柜号", defaultWidth: 140, sortable: true },
  { key: "operation_type", label: "操作方式", defaultWidth: 100, sortable: true },
  { key: "customer", label: "客户", defaultWidth: 140, sortable: true },
  { key: "order_date", label: "订单日期", defaultWidth: 120, sortable: true },
  { key: "eta", label: "ETA", defaultWidth: 120, sortable: true },
  { key: "pickup_date", label: "提柜日期", defaultWidth: 120, sortable: true },
];

export const ORDER_COLUMN_ORDER_STORAGE_KEY = "gng-orders-column-order";
export const ORDER_COLUMN_WIDTH_STORAGE_KEY = "gng-orders-column-widths";

export const ORDER_SORTABLE_KEYS = ORDER_COLUMNS.map((c) => c.key);

export function getDefaultOrderColumnOrder(): OrderColumnKey[] {
  return ORDER_COLUMNS.map((c) => c.key);
}

export function getDefaultOrderColumnWidths(): Record<string, number> {
  return Object.fromEntries(ORDER_COLUMNS.map((c) => [c.key, c.defaultWidth]));
}

export function isOrderDateColumn(key: OrderColumnKey): boolean {
  return key === "order_date" || key === "eta" || key === "pickup_date";
}
