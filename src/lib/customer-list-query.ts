import {Prisma} from "@prisma/client";
import {CUSTOMER_SORTABLE_KEYS, type CustomerColumnKey} from "@/lib/customer-columns";

const SORTABLE_SET = new Set<string>(CUSTOMER_SORTABLE_KEYS);

export type SortOrder = "asc" | "desc";

/** 列表默认只查未软删的记录 */
export const customerListBaseWhere: Prisma.customersWhereInput = {
    deleted_at: null,
};

export function parseCustomerSortParams(sortBy: string | null, sortOrder: string | null) {
    const order: SortOrder = sortOrder === "desc" ? "desc" : "asc";
    if (!sortBy || sortBy === "default" || !SORTABLE_SET.has(sortBy)) {
        return {sortBy: null as CustomerColumnKey | null, sortOrder: order};
    }
    return {sortBy: sortBy as CustomerColumnKey, sortOrder: order};
}


export function buildCustomerListOrderBy(
    sortBy: CustomerColumnKey | null,
    sortOrder: SortOrder,
): Prisma.customersOrderByWithRelationInput[] {
    if (!sortBy) return [{id: "desc"}];
    return [{[sortBy]: sortOrder}, {id: "desc"}];
}

export function buildCustomerSearchWhere(
    keyword?: string | null,
): Prisma.customersWhereInput {
    const base = {...customerListBaseWhere};
    if (!keyword?.trim()) return base;
    const q = keyword.trim();
    return {
        ...base,
        OR: [
            {name: {contains: q, mode: "insensitive"}},
            {contact: {contains: q, mode: "insensitive"}},
            {phone: {contains: q, mode: "insensitive"}},
        ],
    };
}