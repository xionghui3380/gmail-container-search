import { Prisma } from "@prisma/client";
import { ORDER_SORTABLE_KEYS, type OrderColumnKey } from "@/lib/order-columns";

const SORTABLE_SET = new Set<string>(ORDER_SORTABLE_KEYS);

export type SortOrder = "asc" | "desc";

export function parseOrderSortParams(sortBy: string | null, sortOrder: string | null) {
  const order: SortOrder = sortOrder === "desc" ? "desc" : "asc";
  if (!sortBy || sortBy === "default" || !SORTABLE_SET.has(sortBy)) {
    return { sortBy: null as OrderColumnKey | null, sortOrder: order };
  }
  return { sortBy: sortBy as OrderColumnKey, sortOrder: order };
}

export function buildOrderListOrderBy(
  sortBy: OrderColumnKey | null,
  sortOrder: SortOrder,
): Prisma.ordersOrderByWithRelationInput[] {
  if (!sortBy) return [{ id: "desc" }];
  return [{ [sortBy]: sortOrder }, { id: "desc" }];
}

export function buildOrderSearchWhere(
  containerNo?: string | null,
): Prisma.ordersWhereInput | undefined {
  if (!containerNo?.trim()) return undefined;
  return {
    container_no: { contains: containerNo.trim(), mode: "insensitive" },
  };
}
