export type CustomerColumnKey =
    | "name"
    | "contact"
    | "phone"
    | "email"
    | "address"
    | "is_active";

export type CustomerDataColumn = {
    key: CustomerColumnKey;
    label: string;
    defaultWidth: number;
    sortable: boolean;
};

export const CUSTOMER_COLUMNS: CustomerDataColumn[] = [
    { key: "name", label: "客户名称", defaultWidth: 160, sortable: true },
    { key: "contact", label: "联系人", defaultWidth: 100, sortable: true },
    { key: "phone", label: "电话", defaultWidth: 120, sortable: false },
    { key: "email", label: "邮箱", defaultWidth: 180, sortable: false },
    { key: "address", label: "地址", defaultWidth: 200, sortable: false },
    { key: "is_active", label: "启用", defaultWidth: 80, sortable: true },
];

export const CUSTOMER_COLUMN_ORDER_STORAGE_KEY = "gng-customers-column-order";
export const CUSTOMER_COLUMN_WIDTH_STORAGE_KEY = "gng-customers-column-widths";

export const CUSTOMER_SORTABLE_KEYS = CUSTOMER_COLUMNS.filter((c) => c.sortable).map(
    (c) => c.key,
);

export function getDefaultCustomerColumnOrder(): CustomerColumnKey[] {
    return CUSTOMER_COLUMNS.map((c) => c.key);
}

export function getDefaultCustomerColumnWidths(): Record<string, number> {
    return Object.fromEntries(CUSTOMER_COLUMNS.map((c) => [c.key, c.defaultWidth]));
}