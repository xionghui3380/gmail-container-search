export type ParseResultColumnKey =
  | "created_at"
  | "container_no"
  | "operation_type"
  | "customer"
  | "driver"
  | "order_date"
  | "eta"
  | "lfd"
  | "pickup_date"
  | "email_subject"
  | "email_from"
  | "email_date"
  | "parse_status"
  | "error_message";

export type ParseResultDataColumn = {
  key: ParseResultColumnKey;
  label: string;
  defaultWidth: number;
  sortable: boolean;
};

export const PARSE_RESULT_COLUMNS: ParseResultDataColumn[] = [
  { key: "container_no", label: "柜号", defaultWidth: 140, sortable: true },
  { key: "operation_type", label: "操作方式", defaultWidth: 90, sortable: true },
  { key: "customer", label: "客户", defaultWidth: 120, sortable: true },
  { key: "driver", label: "提柜司机", defaultWidth: 100, sortable: true },
  { key: "order_date", label: "订单日期", defaultWidth: 110, sortable: true },
  { key: "eta", label: "ETA", defaultWidth: 110, sortable: true },
  { key: "lfd", label: "LFD", defaultWidth: 110, sortable: true },
  { key: "pickup_date", label: "提柜日期", defaultWidth: 110, sortable: true },
  { key: "created_at", label: "创建时间", defaultWidth: 180, sortable: true },
  { key: "email_subject", label: "邮件标题", defaultWidth: 180, sortable: true },
  { key: "email_from", label: "发件人", defaultWidth: 140, sortable: true },
  { key: "email_date", label: "邮件时间", defaultWidth: 150, sortable: true },
  { key: "parse_status", label: "解析状态", defaultWidth: 90, sortable: true },
  { key: "error_message", label: "错误信息", defaultWidth: 160, sortable: false },
];

export const PARSE_RESULT_COLUMN_ORDER_STORAGE_KEY = "gng-parse-result-column-order";
export const PARSE_RESULT_COLUMN_WIDTH_STORAGE_KEY = "gng-parse-result-column-widths";

export const PARSE_RESULT_SORTABLE_KEYS = PARSE_RESULT_COLUMNS.filter((c) => c.sortable).map(
  (c) => c.key,
);

export function getDefaultParseResultColumnOrder(): ParseResultColumnKey[] {
  return PARSE_RESULT_COLUMNS.map((c) => c.key);
}

export function getDefaultParseResultColumnWidths(): Record<string, number> {
  return Object.fromEntries(PARSE_RESULT_COLUMNS.map((c) => [c.key, c.defaultWidth]));
}

export function isParseResultDateColumn(key: ParseResultColumnKey): boolean {
  return (
    key === "created_at" ||
    key === "order_date" ||
    key === "eta" ||
    key === "lfd" ||
    key === "pickup_date" ||
    key === "email_date"
  );
}

const PARSE_STATUS_OPTIONS = [
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
