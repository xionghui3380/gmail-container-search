import ExcelJS from "exceljs";

export function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null && "text" in value) {
    return String((value as { text?: string }).text ?? "");
  }
  if (typeof value === "object" && value !== null && "result" in value) {
    return String((value as { result?: ExcelJS.CellValue }).result ?? "");
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).trim();
}

export function cellToNumber(value: ExcelJS.CellValue): number | null {
  const raw = cellToString(value).replace(/,/g, "");
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

export function cellToDate(value: ExcelJS.CellValue): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const raw = cellToString(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export async function loadWorkbook(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return workbook;
}

export function getWorksheetRows(worksheet: ExcelJS.Worksheet, maxCol = 40) {
  const rows: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > worksheet.rowCount) return;
    const values: string[] = [];
    for (let col = 1; col <= maxCol; col++) {
      values.push(cellToString(row.getCell(col).value));
    }
    while (values.length > 0 && values[values.length - 1] === "") {
      values.pop();
    }
    if (values.some(Boolean)) rows.push(values);
  });
  return rows;
}
