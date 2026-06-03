export type CargoOrderColumnKey =
  | "order_id"
  | "container_no"
  | "operation_type"
  | "email_subject"
  | "email_from"
  | "email_date"
  | "parse_status"
  | "error_message";

export type CargoOrderDataColumn = {
  key: CargoOrderColumnKey;
  label: string;
  defaultWidth: number;
  sortable: boolean;
};

export const CARGO_ORDER_COLUMNS: CargoOrderDataColumn[] = [
  { key: "order_id", label: "订单ID", defaultWidth: 90, sortable: true },
  { key: "container_no", label: "柜号", defaultWidth: 140, sortable: true },
  { key: "operation_type", label: "操作方式", defaultWidth: 100, sortable: true },
  { key: "email_subject", label: "邮件标题", defaultWidth: 200, sortable: true },
  { key: "email_from", label: "发件人", defaultWidth: 160, sortable: true },
  { key: "email_date", label: "邮件时间", defaultWidth: 160, sortable: true },
  { key: "parse_status", label: "解析状态", defaultWidth: 100, sortable: true },
  { key: "error_message", label: "错误信息", defaultWidth: 180, sortable: false },
];

export const CARGO_ORDER_COLUMN_ORDER_STORAGE_KEY = "gng-cargo-orders-column-order";
export const CARGO_ORDER_COLUMN_WIDTH_STORAGE_KEY = "gng-cargo-orders-column-widths";

export const CARGO_ORDER_SORTABLE_KEYS = CARGO_ORDER_COLUMNS.filter((c) => c.sortable).map(
  (c) => c.key,
);

export function getDefaultCargoOrderColumnOrder(): CargoOrderColumnKey[] {
  return CARGO_ORDER_COLUMNS.map((c) => c.key);
}

export function getDefaultCargoOrderColumnWidths(): Record<string, number> {
  return Object.fromEntries(CARGO_ORDER_COLUMNS.map((c) => [c.key, c.defaultWidth]));
}

export function isCargoOrderDateColumn(key: CargoOrderColumnKey): boolean {
  return key === "email_date";
}

export const PARSE_STATUS_OPTIONS = [
  { value: "pending", label: "待解析" },
  { value: "parsing", label: "解析中" },
  { value: "success", label: "成功" },
  { value: "failed", label: "失败" },
  { value: "partial_success", label: "部分成功" },
] as const;

export function formatParseStatus(value?: string | null) {
  if (!value) return "-";
  const found = PARSE_STATUS_OPTIONS.find((o) => o.value === value);
  return found?.label ?? value;
}
