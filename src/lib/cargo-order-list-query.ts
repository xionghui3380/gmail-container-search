import { Prisma } from "@prisma/client";
import { CARGO_ORDER_SORTABLE_KEYS, type CargoOrderColumnKey } from "@/lib/cargo-order-columns";

const SORTABLE_SET = new Set<string>(CARGO_ORDER_SORTABLE_KEYS);

export type SortOrder = "asc" | "desc";

export function parseCargoOrderSortParams(sortBy: string | null, sortOrder: string | null) {
  const order: SortOrder = sortOrder === "desc" ? "desc" : "asc";
  if (!sortBy || sortBy === "default" || !SORTABLE_SET.has(sortBy)) {
    return { sortBy: null as CargoOrderColumnKey | null, sortOrder: order };
  }
  return { sortBy: sortBy as CargoOrderColumnKey, sortOrder: order };
}

export function buildCargoOrderListOrderBy(
  sortBy: CargoOrderColumnKey | null,
  sortOrder: SortOrder,
): Prisma.containersOrderByWithRelationInput[] {
  if (!sortBy) return [{ id: "desc" }];
  return [{ [sortBy]: sortOrder }, { id: "desc" }];
}

export function buildCargoOrderSearchWhere(
  containerNo?: string | null,
): Prisma.containersWhereInput | undefined {
  if (!containerNo?.trim()) return undefined;
  return {
    container_no: { contains: containerNo.trim(), mode: "insensitive" },
  };
}
