import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { error, success } from "@/lib/api-response";
import {
  buildCargoColumnFilters,
  buildCargoOrderBy,
  buildCargoSearchWhere,
  parseFilters,
  parseSortParams,
} from "@/lib/cargo-list-query";
import { requireUser } from "@/lib/require-user";
import { serialize } from "@/lib/serialize";
import type { Prisma } from "@prisma/client";

/** 货柜管理列表：containers + warehouse_summaries */
export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return error("未登录", 401);

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? 50)));
  const search = searchParams.get("search")?.trim();
  const containerNo = searchParams.get("containerNo")?.trim();
  const customer = searchParams.get("customer")?.trim();
  const filters = parseFilters(searchParams.get("filters"));
  const { sortBy, sortOrder } = parseSortParams(
    searchParams.get("sortBy"),
    searchParams.get("sortOrder"),
  );
  const skip = (page - 1) * pageSize;

  const columnConditions = buildCargoColumnFilters(filters);
  const searchCondition = buildCargoSearchWhere(search, containerNo, undefined, customer);

  const where: Prisma.containersWhereInput = {
    deleted_at: null,
    ...(searchCondition ? searchCondition : {}),
    ...(columnConditions.length > 0 ? { AND: columnConditions } : {}),
  };

  const orderBy = buildCargoOrderBy(sortBy, sortOrder);

  const [total, items] = await Promise.all([
    prisma.containers.count({ where }),
    prisma.containers.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      include: {
        warehouse_summaries: {
          orderBy: { warehouse_code: "asc" },
          select: {
            warehouse_code: true,
            total_cartons: true,
            item_count: true,
          },
        },
      },
    }),
  ]);

  return success(serialize(items), {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  });
}
