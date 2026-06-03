import { format } from "date-fns";
import type { ColumnKey } from "@/lib/container-columns";
import { isDateColumn } from "@/lib/container-columns";

export function formatCellDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return format(date, "yyyy-MM-dd");
}

export function formatCellDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return format(date, "yyyy-MM-dd HH:mm");
}

export function toDateInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "yyyy-MM-dd");
}

export function toDateTimeLocalValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function renderOperationType(value: unknown) {
  return value === "lcl" ? "拆柜" : value === "fcl" ? "整柜" : String(value ?? "-");
}

export function renderBoolean(value: unknown) {
  if (value === true || value === "true") return "是";
  if (value === false || value === "false") return "否";
  return "-";
}

export function renderSnapshotValue(key: ColumnKey, value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (key === "operation_type") return renderOperationType(value);
  if (key === "backend_delivery") return renderBoolean(value);
  if (key === "appointment_time") return formatCellDateTime(value as string);
  if (isDateColumn(key)) return formatCellDate(value as string);
  return String(value);
}
