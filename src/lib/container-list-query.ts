import { Prisma } from "@prisma/client";
import { SORTABLE_COLUMN_KEYS, type ColumnKey } from "@/lib/container-columns";

const SORTABLE_SET = new Set<string>(SORTABLE_COLUMN_KEYS);

export type SortOrder = "asc" | "desc";

export function parseSortParams(sortBy: string | null, sortOrder: string | null) {
  const order: SortOrder = sortOrder === "desc" ? "desc" : "asc";
  if (!sortBy || sortBy === "default" || !SORTABLE_SET.has(sortBy)) {
    return { sortBy: null as ColumnKey | null, sortOrder: order };
  }
  return { sortBy: sortBy as ColumnKey, sortOrder: order };
}

export function buildOrderBy(
  sortBy: ColumnKey | null,
  sortOrder: SortOrder,
): Prisma.containersOrderByWithRelationInput[] {
  if (!sortBy) {
    // 默认按 sort 字段排序（PostgreSQL null 在 asc 时默认排最后）
    return [{ sort: "asc" }, { id: "asc" }];
  }
  return [{ [sortBy]: sortOrder }, { id: "asc" }];
}

export function parseFilters(raw: string | null): Partial<Record<ColumnKey, string>> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const filters: Partial<Record<ColumnKey, string>> = {};
    for (const key of SORTABLE_COLUMN_KEYS) {
      const value = parsed[key]?.trim();
      if (value) filters[key as ColumnKey] = value;
    }
    return filters;
  } catch {
    return {};
  }
}

function parseFilterDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function buildColumnFilters(
  filters: Partial<Record<ColumnKey, string>>,
): Prisma.containersWhereInput[] {
  const conditions: Prisma.containersWhereInput[] = [];

  for (const [key, value] of Object.entries(filters)) {
    if (!value) continue;
    switch (key as ColumnKey) {
      case "container_no":
      case "container_type":
      case "terminal":
      case "customer":
      case "mbl":
      case "pickup_driver":
        conditions.push({
          [key]: { contains: value, mode: "insensitive" },
        });
        break;
      case "operation_type":
        if (value === "fcl" || value === "lcl") {
          conditions.push({ operation_type: value });
        }
        break;
      case "eta_date":
      case "lfd_date": {
        const date = parseFilterDate(value);
        if (date) conditions.push({ [key]: date });
        break;
      }
    }
  }

  return conditions;
}

export function buildSearchWhere(
  search: string | undefined,
  containerNo?: string | null,
  mbl?: string | null,
  customer?: string | null,
): Prisma.containersWhereInput | undefined {
  const conditions: Prisma.containersWhereInput[] = [];

  if (search) {
    conditions.push({
      OR: [
        { container_no: { contains: search, mode: "insensitive" } },
        { mbl: { contains: search, mode: "insensitive" } },
        { customer: { contains: search, mode: "insensitive" } },
        { pickup_driver: { contains: search, mode: "insensitive" } },
        { return_driver: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (containerNo?.trim()) {
    conditions.push({
      container_no: { contains: containerNo.trim(), mode: "insensitive" },
    });
  }

  if (mbl?.trim()) {
    conditions.push({
      mbl: { contains: mbl.trim(), mode: "insensitive" },
    });
  }

  if (customer?.trim()) {
    conditions.push({
      customer: { contains: customer.trim(), mode: "insensitive" },
    });
  }

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return { AND: conditions };
}
