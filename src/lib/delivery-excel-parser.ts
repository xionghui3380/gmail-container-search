import type { Prisma } from "@prisma/client";
import {
  cellToNumber,
  cellToString,
  getWorksheetRows,
  loadWorkbook,
  normalizeHeader,
} from "@/lib/excel-utils";

export type DeliveryItemParsed = {
  container_no: string;
  customer_code: string | null;
  fba_id: string | null;
  reference_id: string | null;
  cbm: number | null;
  weight: number | null;
  carton_count: number | null;
  warehouse_code: string | null;
  delivery_method: string | null;
  customer_note: string | null;
  actual_carton_count: number | null;
  pallet_count: number | null;
  warehouse_note: string | null;
  warnings: string[];
};

export type WarehouseSummaryComputed = {
  warehouse_code: string;
  total_cartons: number;
  item_count: number;
};

export type DeliveryParseResult = {
  headerRow: number;
  items: DeliveryItemParsed[];
  summaries: WarehouseSummaryComputed[];
  warnings: string[];
};

type DeliveryFieldKey = keyof Omit<DeliveryItemParsed, "warnings">;

const FIELD_ALIASES: Record<string, DeliveryFieldKey> = {
  柜号: "container_no",
  containerno: "container_no",
  "客户代码/唛头": "customer_code",
  "so/客户代码/唛头": "customer_code",
  客户代码: "customer_code",
  唛头: "customer_code",
  so: "customer_code",
  fbaid: "fba_id",
  "fba id": "fba_id",
  fba: "fba_id",
  referenceid: "reference_id",
  "reference id": "reference_id",
  reference: "reference_id",
  po: "reference_id",
  cbm: "cbm",
  体积: "cbm",
  weight: "weight",
  重量: "weight",
  cartons: "carton_count",
  箱数: "carton_count",
  warehousecode: "warehouse_code",
  仓库代码: "warehouse_code",
  仓库: "warehouse_code",
  deliverymethod: "delivery_method",
  派送方式: "delivery_method",
  customernote: "customer_note",
  客人备注: "customer_note",
  客户备注: "customer_note",
  actualcartons: "actual_carton_count",
  实际箱数: "actual_carton_count",
  palletcount: "pallet_count",
  打板数量: "pallet_count",
  warehousenote: "warehouse_note",
  仓库备注: "warehouse_note",
};

const HEADER_KEYWORDS = [
  "fba", "reference", "warehouse", "仓库", "箱数", "carton", "柜号",
  "重量", "weight", "cbm", "体积", "派送", "delivery", "客户", "唛头",
  "so", "po", "备注", "note", "打板", "pallet", "实际", "actual",
];

function isSummaryRow(values: string[]) {
  const joined = values.join(" ").toLowerCase();
  return joined.includes("合计") || joined.includes("总计") || joined.includes("total");
}

function detectHeaderRow(rows: string[][]) {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const normalized = rows[i].map((v) => normalizeHeader(v));
    const hits = normalized.filter((cell) =>
      HEADER_KEYWORDS.some((keyword) => cell.includes(normalizeHeader(keyword))),
    ).length;
    if (hits >= 2) return i;
  }
  return 0;
}

function buildColumnMap(headerRow: string[]) {
  return headerRow.map((header) => {
    const normalized = normalizeHeader(header);
    return FIELD_ALIASES[normalized] ?? FIELD_ALIASES[header.trim()] ?? null;
  });
}

export function aggregateWarehouseSummaries(
  items: DeliveryItemParsed[],
): WarehouseSummaryComputed[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const item of items) {
    if (!item.warehouse_code) continue;
    const key = item.warehouse_code.toUpperCase();
    const cartons = item.carton_count ?? 0;
    const prev = map.get(key) ?? { total: 0, count: 0 };
    map.set(key, { total: prev.total + cartons, count: prev.count + 1 });
  }
  return Array.from(map.entries())
    .map(([warehouse_code, value]) => ({
      warehouse_code,
      total_cartons: value.total,
      item_count: value.count,
    }))
    .sort((a, b) => a.warehouse_code.localeCompare(b.warehouse_code));
}

export async function parseDeliveryExcelBuffer(
  buffer: Buffer,
): Promise<DeliveryParseResult> {
  const workbook = await loadWorkbook(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Excel 文件中没有工作表");
  }

  const matrix = getWorksheetRows(worksheet, 30);
  return parseDeliveryMatrix(matrix);
}

/** 支持 Excel / CSV 附件 */
export async function parseDeliveryFileBuffer(
  buffer: Buffer,
  filename?: string,
): Promise<DeliveryParseResult> {
  if (filename?.toLowerCase().endsWith(".csv")) {
    const matrix = parseCsvBufferToMatrix(buffer);
    return parseDeliveryMatrix(matrix);
  }
  return parseDeliveryExcelBuffer(buffer);
}

function parseCsvBufferToMatrix(buffer: Buffer): string[][] {
  let text = buffer.toString("utf-8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (text.includes("\ufffd")) {
    text = buffer.toString("latin1");
  }

  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  const delimiter =
    (firstLine.match(/\t/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? "\t" : ",";

  return lines.map((line) => parseCsvLine(line, delimiter));
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseDeliveryMatrix(matrix: string[][]): DeliveryParseResult {
  const headerRowIndex = detectHeaderRow(matrix);
  const headerRow = matrix[headerRowIndex] ?? [];
  const columnMap = buildColumnMap(headerRow);
  const warnings: string[] = [];
  const items: DeliveryItemParsed[] = [];

  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    const line = matrix[i];
    if (!line.some(Boolean) || isSummaryRow(line)) continue;

    const row: DeliveryItemParsed = {
      container_no: "",
      customer_code: null,
      fba_id: null,
      reference_id: null,
      cbm: null,
      weight: null,
      carton_count: null,
      warehouse_code: null,
      delivery_method: null,
      customer_note: null,
      actual_carton_count: null,
      pallet_count: null,
      warehouse_note: null,
      warnings: [],
    };

    line.forEach((value, colIndex) => {
      const field = columnMap[colIndex];
      if (!field || field === "container_no") return;
      const text = typeof value === "string" ? value.trim() : cellToString(value);
      if (!text) return;

      if (
        field === "carton_count" ||
        field === "actual_carton_count" ||
        field === "pallet_count"
      ) {
        row[field] = cellToNumber(value);
      } else if (field === "cbm" || field === "weight") {
        row[field] = cellToNumber(value);
      } else {
        row[field] = text;
      }
    });

    const containerCol = columnMap.findIndex((f) => f === "container_no");
    if (containerCol >= 0) {
      const fromRow = (line[containerCol] ?? "").trim().toUpperCase();
      row.container_no = fromRow;
    }
    if (!row.container_no) {
      row.warnings.push("柜号为空");
      warnings.push(`第 ${i + 1} 行：柜号为空`);
    }

    const hasOtherData =
      !!row.fba_id ||
      !!row.reference_id ||
      !!row.warehouse_code ||
      row.carton_count !== null ||
      row.cbm !== null ||
      row.weight !== null;
    if (!row.container_no && !hasOtherData) continue;
    if (row.container_no && !hasOtherData) continue;

    if (!row.warehouse_code) {
      row.warnings.push("仓库代码为空");
      warnings.push(`第 ${i + 1} 行：仓库代码为空`);
    }
    if (row.carton_count === null) {
      row.warnings.push("箱数为空");
      warnings.push(`第 ${i + 1} 行：箱数为空`);
    }

    items.push(row);
  }

  return {
    headerRow: headerRowIndex + 1,
    items,
    summaries: aggregateWarehouseSummaries(items),
    warnings,
  };
}

export function deliveryItemToCreateInput(
  item: DeliveryItemParsed,
  meta?: {
    attachment_id?: number;
    container_id?: number;
    batch_no?: string;
  },
): Prisma.delivery_itemsCreateManyInput {
  return {
    container_no: item.container_no,
    attachment_id: meta?.attachment_id,
    container_id: meta?.container_id,
    batch_no: meta?.batch_no,
    customer_code: item.customer_code,
    fba_id: item.fba_id,
    reference_id: item.reference_id,
    cbm: item.cbm,
    weight: item.weight,
    carton_count: item.carton_count,
    warehouse_code: item.warehouse_code,
    delivery_method: item.delivery_method,
    customer_note: item.customer_note,
    actual_carton_count: item.actual_carton_count,
    pallet_count: item.pallet_count,
    warehouse_note: item.warehouse_note,
    warning: item.warnings.length > 0 ? item.warnings.join("; ") : null,
    is_warning: item.warnings.length > 0,
  };
}
