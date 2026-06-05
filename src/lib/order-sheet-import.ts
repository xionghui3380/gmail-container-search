import type { operation_type } from "@prisma/client";
import type { z } from "zod";
import type { containerCreateSchema } from "@/lib/validators";
import {
  cellToDate,
  cellToNumber,
  getWorksheetRows,
  loadWorkbook,
  normalizeHeader,
} from "@/lib/excel-utils";

type ContainerInput = z.infer<typeof containerCreateSchema>;

export type OrderSheetRow = Partial<ContainerInput> & {
  container_no: string;
  rowNumber: number;
};

export type OrderSheetImportResult = {
  total: number;
  imported: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
  rows: OrderSheetRow[];
};

const HEADER_ALIASES: Record<string, keyof ContainerInput> = {
  柜型: "container_type",
  重量: "weight",
  mbl: "mbl",
  柜号: "container_no",
  "码头/查验站": "terminal",
  码头: "terminal",
  查验站: "terminal",
  客户: "customer",
  提柜司机: "pickup_driver",
  还柜司机: "return_driver",
  do: "do_number",
  订单日期: "order_date",
  eta: "eta_date",
  操作方式: "operation_type",
  送货地: "delivery_location",
  送货地点: "delivery_location",
  lfd: "lfd_date",
  提柜日期: "pickup_date",
  预报窗口期: "forecast_window",
  报空日期: "empty_report_date",
  还柜日期: "return_date",
  预约号码: "appointment_no",
  预约时间: "appointment_time",
  约仓账号: "warehouse_account",
  后端送: "backend_delivery",
  预约同事: "appointment_colleague",
  备注: "remarks",
};

function mapOperationType(value: string): operation_type {
  const v = value.trim();
  if (v === "拆柜" || v.toLowerCase() === "lcl") return "lcl";
  return "fcl";
}

function mapDoNumber(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (!v || v === "false") return null;
  if (v === "true") return "YES";
  return value.trim();
}

function mapBackendDelivery(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === "true" || v === "是" || v === "yes" || v === "1";
}

function assignField(
  target: Partial<ContainerInput>,
  key: keyof ContainerInput,
  raw: string,
) {
  switch (key) {
    case "container_type":
      target.container_type = raw === "45" ? "45" : "40";
      break;
    case "weight":
      target.weight = cellToNumber(raw);
      break;
    case "operation_type":
      target.operation_type = mapOperationType(raw);
      break;
    case "backend_delivery":
      target.backend_delivery = mapBackendDelivery(raw);
      break;
    case "do_number":
      target.do_number = mapDoNumber(raw);
      break;
    case "order_date":
    case "eta_date":
    case "lfd_date":
    case "pickup_date":
    case "empty_report_date":
    case "return_date": {
      const date = cellToDate(raw);
      target[key] = date ? date.toISOString().slice(0, 10) : null;
      break;
    }
    case "appointment_time": {
      const date = cellToDate(raw);
      target.appointment_time = date ? date.toISOString() : null;
      break;
    }
    case "container_no":
      target.container_no = raw.trim().toUpperCase();
      break;
    default:
      (target as Record<string, unknown>)[key] = raw.trim() || null;
  }
}

function detectHeaderIndex(rows: string[][]) {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const normalized = rows[i].map(normalizeHeader);
    if (normalized.includes("柜号") || normalized.includes("container_no")) {
      return i;
    }
  }
  return 0;
}

export async function parseOrderSheetBuffer(buffer: Buffer): Promise<OrderSheetImportResult> {
  const workbook = await loadWorkbook(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return {
      total: 0,
      imported: 0,
      skipped: 0,
      errors: [{ row: 0, message: "Excel 无工作表" }],
      rows: [],
    };
  }

  const matrix = getWorksheetRows(worksheet);
  const headerIndex = detectHeaderIndex(matrix);
  const headerRow = matrix[headerIndex] ?? [];
  const columnMap = headerRow.map((header) => {
    const key = HEADER_ALIASES[normalizeHeader(header)];
    return key ?? null;
  });

  const result: OrderSheetImportResult = {
    total: 0,
    imported: 0,
    skipped: 0,
    errors: [],
    rows: [],
  };

  for (let i = headerIndex + 1; i < matrix.length; i++) {
    const line = matrix[i];
    result.total += 1;

    const parsed: Partial<ContainerInput> & { rowNumber: number } = {
      rowNumber: i + 1,
      container_type: "40",
      operation_type: "lcl",
      backend_delivery: false,
    };

    line.forEach((value, colIndex) => {
      const field = columnMap[colIndex];
      if (!field || !value) return;
      assignField(parsed, field, value);
    });

    const containerNo = parsed.container_no?.trim().toUpperCase();
    if (!containerNo) {
      result.skipped += 1;
      result.errors.push({ row: i + 1, message: "柜号为空" });
      continue;
    }

    if (!parsed.terminal?.trim()) parsed.terminal = "UNKNOWN";
    if (!parsed.customer?.trim()) parsed.customer = "UNKNOWN";

    parsed.container_no = containerNo;
    result.rows.push(parsed as OrderSheetRow);
    result.imported += 1;
  }

  return result;
}

export async function parseOrderSheetFile(filePath: string) {
  const fs = await import("fs/promises");
  const buffer = await fs.readFile(filePath);
  return parseOrderSheetBuffer(buffer);
}
