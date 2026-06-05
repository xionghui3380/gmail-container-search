import ExcelJS from "exceljs";

export type DeliveryItemExportRow = {
  container_no?: string | null;
  fba_id?: string | null;
  reference_id?: string | null;
  cbm?: unknown;
  weight?: unknown;
  carton_count?: number | null;
  warehouse_code?: string | null;
  delivery_method?: string | null;
  warning?: string | null;
};

/** 页面展示与导出共用的明细列（不含客户代码、备注、实际箱数等） */
export const DELIVERY_ITEM_COLUMNS = [
  { key: "fba_id", label: "FBA" },
  { key: "reference_id", label: "Reference" },
  { key: "warehouse_code", label: "仓库" },
  { key: "carton_count", label: "箱数" },
  { key: "cbm", label: "CBM" },
  { key: "weight", label: "重量" },
  { key: "delivery_method", label: "派送方式" },
  { key: "warning", label: "警告" },
] as const;

/** 导出时在明细列前加柜号 */
export const DELIVERY_EXPORT_COLUMNS = [
  { key: "container_no", label: "柜号" },
  ...DELIVERY_ITEM_COLUMNS,
] as const;

export type DeliveryExportFormat = "csv" | "xlsx";

export function detectExportFormat(filename?: string | null): DeliveryExportFormat {
  const name = (filename ?? "").trim().toLowerCase();
  if (name.endsWith(".csv")) return "csv";
  return "xlsx";
}

export function buildExportFilename(
  attachmentName?: string | null,
  format?: DeliveryExportFormat,
) {
  const raw = (attachmentName ?? "").trim();
  if (raw) {
    const lower = raw.toLowerCase();
    if (format === "csv" && !lower.endsWith(".csv")) return `${raw}.csv`;
    if (format === "xlsx" && !/\.xlsx?$/.test(lower)) return `${raw}.xlsx`;
    return raw;
  }
  return format === "csv" ? "delivery-items.csv" : "delivery-items.xlsx";
}

function cellValue(value: unknown) {
  if (value == null) return "";
  return String(value);
}

function csvEscape(value: unknown) {
  const text = cellValue(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n") || text.includes("\r")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function exportDeliveryItemsToCsv(items: DeliveryItemExportRow[]) {
  const header = DELIVERY_EXPORT_COLUMNS.map((col) => col.label);
  const lines = [
    header.join(","),
    ...items.map((row) =>
      DELIVERY_EXPORT_COLUMNS.map((col) =>
        csvEscape(row[col.key as keyof DeliveryItemExportRow]),
      ).join(","),
    ),
  ];
  return `\uFEFF${lines.join("\n")}`;
}

export async function exportDeliveryItemsToXlsxBuffer(items: DeliveryItemExportRow[]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("派送明细");
  worksheet.addRow(DELIVERY_EXPORT_COLUMNS.map((col) => col.label));
  for (const row of items) {
    worksheet.addRow(
      DELIVERY_EXPORT_COLUMNS.map((col) => row[col.key as keyof DeliveryItemExportRow] ?? ""),
    );
  }
  worksheet.getRow(1).font = { bold: true };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function encodeContentDisposition(filename: string) {
  const asciiName = filename.replace(/[^\x20-\x7E]/g, "_") || "export";
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encoded}`;
}
