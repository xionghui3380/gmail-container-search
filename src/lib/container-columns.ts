export type ColumnKey =
  | "container_no"
  | "container_type"
  | "terminal"
  | "customer"
  | "mbl"
  | "operation_type"
  | "eta_date"
  | "lfd_date"
  | "pickup_driver";

export type ColumnFilterType = "text" | "select" | "date";

export type DataColumn = {
  key: ColumnKey;
  label: string;
  filterType: ColumnFilterType;
  defaultWidth: number;
  sortable: boolean;
};

export const DATA_COLUMNS: DataColumn[] = [
  {
    key: "container_no",
    label: "柜号",
    filterType: "text",
    defaultWidth: 140,
    sortable: true,
  },
  {
    key: "container_type",
    label: "柜型",
    filterType: "text",
    defaultWidth: 80,
    sortable: true,
  },
  {
    key: "terminal",
    label: "码头",
    filterType: "text",
    defaultWidth: 100,
    sortable: true,
  },
  {
    key: "customer",
    label: "客户",
    filterType: "text",
    defaultWidth: 120,
    sortable: true,
  },
  {
    key: "mbl",
    label: "MBL",
    filterType: "text",
    defaultWidth: 140,
    sortable: true,
  },
  {
    key: "operation_type",
    label: "操作类型",
    filterType: "select",
    defaultWidth: 100,
    sortable: true,
  },
  {
    key: "eta_date",
    label: "ETA",
    filterType: "date",
    defaultWidth: 120,
    sortable: true,
  },
  {
    key: "lfd_date",
    label: "LFD",
    filterType: "date",
    defaultWidth: 120,
    sortable: true,
  },
  {
    key: "pickup_driver",
    label: "提柜司机",
    filterType: "text",
    defaultWidth: 110,
    sortable: true,
  },
];

export const COLUMN_ORDER_STORAGE_KEY = "gng-container-column-order";
export const COLUMN_WIDTH_STORAGE_KEY = "gng-container-column-widths";

export const SORTABLE_COLUMN_KEYS = DATA_COLUMNS.map((c) => c.key);

export function getDefaultColumnOrder(): ColumnKey[] {
  return DATA_COLUMNS.map((c) => c.key);
}

export function getDefaultColumnWidths(): Record<string, number> {
  return Object.fromEntries(DATA_COLUMNS.map((c) => [c.key, c.defaultWidth]));
}
