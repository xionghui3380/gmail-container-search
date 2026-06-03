import { Prisma } from "@prisma/client";
import { PARSE_RESULT_SORTABLE_KEYS, type ParseResultColumnKey } from "@/lib/parse-result-columns";

const SORTABLE_SET = new Set<string>(PARSE_RESULT_SORTABLE_KEYS);

export type SortOrder = "asc" | "desc";

export function parseParseResultSortParams(sortBy: string | null, sortOrder: string | null) {
  const order: SortOrder = sortOrder === "desc" ? "desc" : "asc";
  if (!sortBy || sortBy === "default" || !SORTABLE_SET.has(sortBy)) {
    return { sortBy: null as ParseResultColumnKey | null, sortOrder: order };
  }
  return { sortBy: sortBy as ParseResultColumnKey, sortOrder: order };
}

export function buildParseResultListOrderBy(
  sortBy: ParseResultColumnKey | null,
  sortOrder: SortOrder,
): Prisma.containersOrderByWithRelationInput[] {
  if (!sortBy) return [{ id: "desc" }];
  return [{ [sortBy]: sortOrder }, { id: "desc" }];
}

export function buildParseResultSearchWhere(
  containerNo?: string | null,
  batchNo?: string | null,
): Prisma.containersWhereInput | undefined {
  const conditions: Prisma.containersWhereInput[] = [];
  if (containerNo?.trim()) {
    conditions.push({
      container_no: { contains: containerNo.trim(), mode: "insensitive" },
    });
  }
  if (batchNo?.trim()) {
    conditions.push({ batch_no: { contains: batchNo.trim(), mode: "insensitive" } });
  }
  if (conditions.length === 0) return undefined;
  return { AND: conditions };
}
